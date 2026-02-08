import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import readline from 'node:readline'

export interface CliSession {
  sessionId: string
  title: string
  timestamp: string
  toolId: string
}

/** 历史消息（简化结构，用于加载到前端） */
export interface CliMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

/** 将项目路径转换为 Claude Code 的项目目录名 */
function projectPathToHash(projectPath: string): string {
  return projectPath.replace(/\//g, '-')
}

/** 从 JSONL 文件的前几行提取 session 信息 */
async function parseSessionFile(filePath: string): Promise<{ sessionId: string; title: string; timestamp: string } | null> {
  try {
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

    let sessionId = ''
    let title = ''
    let timestamp = ''

    let lineCount = 0
    for await (const line of rl) {
      if (lineCount > 10) break
      lineCount++

      try {
        const obj = JSON.parse(line)
        // 从 queue-operation 或 user 行中获取 sessionId
        if (obj.sessionId && !sessionId) {
          sessionId = obj.sessionId
        }
        if (obj.timestamp && !timestamp) {
          timestamp = obj.timestamp
        }
        // 第一条 user 消息作为标题
        if (obj.type === 'user' && obj.message?.content && !title) {
          const content = typeof obj.message.content === 'string'
            ? obj.message.content
            : JSON.stringify(obj.message.content)
          title = content.slice(0, 80)
          break // 拿到标题就够了
        }
      } catch {
        // 跳过无法解析的行
      }
    }

    rl.close()
    stream.destroy()

    if (!sessionId) return null
    return { sessionId, title: title || 'Untitled', timestamp }
  } catch {
    return null
  }
}

/** 列出某个项目路径下某 CLI 工具的已有 session 列表 */
export async function listCliSessions(toolId: string, projectPath: string): Promise<CliSession[]> {
  const claudeDir = path.join(os.homedir(), '.claude', 'projects')

  if (toolId === 'claude-code') {
    const hash = projectPathToHash(projectPath)
    const projectDir = path.join(claudeDir, hash)

    if (!fs.existsSync(projectDir)) return []

    const files = fs.readdirSync(projectDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => ({
        name: f,
        fullPath: path.join(projectDir, f),
        mtime: fs.statSync(path.join(projectDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime) // 最近的在前

    const sessions: CliSession[] = []
    for (const file of files) {
      const info = await parseSessionFile(file.fullPath)
      if (info) {
        sessions.push({
          sessionId: info.sessionId,
          title: info.title,
          timestamp: info.timestamp,
          toolId,
        })
      }
    }
    return sessions
  }

  // 其他工具暂不支持列出历史 session
  return []
}

/** 从 JSONL 文件加载某个 session 的对话消息 */
export async function loadCliSessionMessages(toolId: string, projectPath: string, cliSessionId: string): Promise<CliMessage[]> {
  if (toolId === 'claude-code') {
    const claudeDir = path.join(os.homedir(), '.claude', 'projects')
    const hash = projectPathToHash(projectPath)
    const filePath = path.join(claudeDir, hash, `${cliSessionId}.jsonl`)

    if (!fs.existsSync(filePath)) return []

    const messages: CliMessage[] = []

    try {
      const stream = fs.createReadStream(filePath, { encoding: 'utf-8' })
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

      for await (const line of rl) {
        try {
          const obj = JSON.parse(line)

          if (obj.type === 'user') {
            const msgContent = obj.message?.content
            if (!msgContent) continue

            // user 消息：字符串 = 正常消息，数组 = tool_result（跳过）
            if (typeof msgContent === 'string') {
              messages.push({
                role: 'user',
                content: msgContent,
                timestamp: obj.timestamp || '',
              })
            }
          } else if (obj.type === 'assistant') {
            const contentArr = obj.message?.content
            if (!Array.isArray(contentArr)) continue

            // 提取纯文本（跳过 thinking 和 tool_use）
            const textParts: string[] = []
            for (const block of contentArr) {
              if (block.type === 'text') {
                // 过滤 <thinking> 块
                let text = block.text || ''
                text = text.replace(/<thinking>[\s\S]*?<\/thinking>\s*/g, '').trim()
                if (text) textParts.push(text)
              }
            }

            if (textParts.length > 0) {
              messages.push({
                role: 'assistant',
                content: textParts.join('\n'),
                timestamp: obj.timestamp || '',
              })
            }
          }
        } catch {
          // 跳过无法解析的行
        }
      }

      rl.close()
      stream.destroy()
    } catch {
      // 文件读取失败
    }

    return messages
  }

  return []
}
