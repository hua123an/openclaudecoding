import * as pty from 'node-pty'
import type { IPty } from 'node-pty'
import os from 'node:os'
import fs from 'node:fs'
import type { StreamEventResult } from '../adapters/base'

export function shellEscape(str: string): string {
  return "'" + str.replace(/'/g, "'\\''") + "'"
}

export interface MessageRunnerOpts {
  sessionId: string
  command: string
  cwd: string
  /** 是否使用 stream-json 模式 */
  streamJson?: boolean
  /** stream-json 行解析器（streamJson=true 时必须） */
  parseStreamEvent?: (line: string) => StreamEventResult | null
  /** 临时文件路径，进程结束后自动删除 */
  tempFile?: string
  onData: (data: string) => void
  onSessionId?: (sessionId: string) => void
  onToolUse?: (toolUse: { name: string; input?: string; content?: string }) => void
  onUsage?: (usage: { inputTokens: number; outputTokens: number; cacheCreationInputTokens?: number; cacheReadInputTokens?: number }) => void
  onDone: (code: number) => void
  onError: (error: string) => void
}

export class MessageRunner {
  private processes = new Map<string, IPty>()
  /** 纯文本模式：thinking 缓冲区 */
  private thinkingBuffers = new Map<string, string>()
  /** stream-json 模式：行缓冲区 */
  private lineBuffers = new Map<string, string>()
  /** 已发送的 sessionId，避免重复 */
  private sessionIds = new Map<string, string>()
  /** 工具调用追踪：sessionId → Map<blockIndex, { name, inputJson }> */
  private toolBlocks = new Map<string, Map<number, { name: string; inputJson: string }>>()

  send(opts: MessageRunnerOpts) {
    this.cancel(opts.sessionId)

    const shell = process.env.SHELL || '/bin/zsh'
    console.log('[messageRunner] pty spawn:', shell, '-l -c', opts.command)

    try {
      const proc = pty.spawn(shell, ['-l', '-c', opts.command], {
        cwd: opts.cwd,
        cols: 120,
        rows: 30,
        env: { ...process.env, HOME: os.homedir() } as Record<string, string>,
      })

      this.processes.set(opts.sessionId, proc)
      console.log('[messageRunner] pty pid:', proc.pid)

      if (opts.streamJson && opts.parseStreamEvent) {
        this.setupStreamJsonMode(opts, proc)
      } else {
        this.setupTextMode(opts, proc)
      }

      proc.onExit(({ exitCode }) => {
        console.log('[messageRunner] exit, code:', exitCode)
        this.cleanup(opts.sessionId)
        // 清理临时文件
        if (opts.tempFile) {
          try { fs.unlinkSync(opts.tempFile) } catch {}
        }
        opts.onDone(exitCode)
      })
    } catch (err: any) {
      console.error('[messageRunner] spawn error:', err.message)
      opts.onError(err.message)
    }
  }

  /** stream-json 模式：按行解析 JSON 事件 */
  private setupStreamJsonMode(opts: MessageRunnerOpts, proc: IPty) {
    this.lineBuffers.set(opts.sessionId, '')
    this.sessionIds.delete(opts.sessionId)

    proc.onData((data: string) => {
      let buf = (this.lineBuffers.get(opts.sessionId) || '') + data

      while (true) {
        const nlIdx = buf.indexOf('\n')
        if (nlIdx === -1) break

        const line = buf.slice(0, nlIdx)
        buf = buf.slice(nlIdx + 1)

        if (!line.trim()) continue

        const event = opts.parseStreamEvent!(line)
        if (!event) continue

        // 提取 session_id
        if (event.sessionId && !this.sessionIds.has(opts.sessionId)) {
          this.sessionIds.set(opts.sessionId, event.sessionId)
          console.log('[messageRunner] captured sessionId:', event.sessionId)
          opts.onSessionId?.(event.sessionId)
        }

        // 提取文本内容
        if (event.text) {
          opts.onData(event.text)
        }

        // 工具调用追踪
        if (event.toolStart) {
          let blocks = this.toolBlocks.get(opts.sessionId)
          if (!blocks) {
            blocks = new Map()
            this.toolBlocks.set(opts.sessionId, blocks)
          }
          blocks.set(event.toolStart.index, { name: event.toolStart.name, inputJson: '' })
        }

        if (event.toolInputDelta) {
          const blocks = this.toolBlocks.get(opts.sessionId)
          const block = blocks?.get(event.toolInputDelta.index)
          if (block) {
            block.inputJson += event.toolInputDelta.json
          }
        }

        if (event.toolEnd) {
          const blocks = this.toolBlocks.get(opts.sessionId)
          const block = blocks?.get(event.toolEnd.index)
          if (block) {
            blocks!.delete(event.toolEnd.index)
            // 只通过工具卡片展示，不再注入 ⏺ 文本标记到消息流
            const detail = this.extractToolDetail(block.name, block.inputJson)
            const content = this.extractToolContent(block.name, block.inputJson)
            opts.onToolUse?.({ name: block.name, input: detail, content })
          }
        }

        // usage 信息
        if (event.usage) {
          opts.onUsage?.(event.usage)
        }
      }

      this.lineBuffers.set(opts.sessionId, buf)
    })
  }

  /** 纯文本模式：过滤 <thinking> 块 */
  private setupTextMode(opts: MessageRunnerOpts, proc: IPty) {
    this.thinkingBuffers.set(opts.sessionId, '')
    let inThinking = false

    proc.onData((data: string) => {
      let buf = (this.thinkingBuffers.get(opts.sessionId) || '') + data

      while (buf.length > 0) {
        if (inThinking) {
          const endIdx = buf.indexOf('</thinking>')
          if (endIdx === -1) {
            this.thinkingBuffers.set(opts.sessionId, buf)
            return
          }
          buf = buf.slice(endIdx + '</thinking>'.length)
          inThinking = false
          if (buf.startsWith('\n')) buf = buf.slice(1)
          if (buf.startsWith('\r\n')) buf = buf.slice(2)
        } else {
          const startIdx = buf.indexOf('<thinking>')
          if (startIdx === -1) {
            const lastLt = buf.lastIndexOf('<')
            if (lastLt !== -1 && lastLt > buf.length - 12) {
              const tail = buf.slice(lastLt)
              if ('<thinking>'.startsWith(tail)) {
                const safe = buf.slice(0, lastLt)
                if (safe) opts.onData(safe)
                this.thinkingBuffers.set(opts.sessionId, tail)
                return
              }
            }
            opts.onData(buf)
            this.thinkingBuffers.set(opts.sessionId, '')
            return
          }
          if (startIdx > 0) {
            opts.onData(buf.slice(0, startIdx))
          }
          buf = buf.slice(startIdx + '<thinking>'.length)
          inThinking = true
        }
      }
      this.thinkingBuffers.set(opts.sessionId, '')
    })
  }

  /** 从工具输入 JSON 中提取关键信息作为显示标签 */
  private extractToolDetail(toolName: string, inputJson: string): string {
    if (!inputJson) return ''
    try {
      const input = JSON.parse(inputJson)
      // 根据工具名提取最有意义的参数
      switch (toolName) {
        case 'Read':
        case 'Write':
        case 'Edit':
          // 文件路径：取文件名部分
          if (input.file_path) {
            const parts = input.file_path.split('/')
            return parts[parts.length - 1] || input.file_path
          }
          return ''
        case 'Bash':
          // 命令：截取前 60 字符
          if (input.command) return input.command.slice(0, 60)
          return ''
        case 'Glob':
          return input.pattern || ''
        case 'Grep':
          return input.pattern || ''
        case 'WebFetch':
          if (input.url) return input.url.slice(0, 60)
          return ''
        case 'WebSearch':
          return input.query || ''
        case 'TodoWrite':
          return input.todos ? `${input.todos.length} items` : ''
        case 'Task':
          return input.description || ''
        default:
          // 通用：尝试取第一个字符串值
          for (const val of Object.values(input)) {
            if (typeof val === 'string' && val.length > 0) {
              return val.length > 60 ? val.slice(0, 60) + '...' : val
            }
          }
          return ''
      }
    } catch {
      return ''
    }
  }

  /** 提取工具卡片展开后的富内容 */
  private extractToolContent(toolName: string, inputJson: string): string {
    if (!inputJson) return ''
    try {
      const input = JSON.parse(inputJson)
      switch (toolName) {
        case 'Edit': {
          const lines: string[] = []
          if (input.file_path) lines.push(input.file_path)
          if (input.old_string) {
            lines.push('--- old')
            const old = input.old_string.length > 500 ? input.old_string.slice(0, 500) + '...' : input.old_string
            lines.push(old)
          }
          if (input.new_string) {
            lines.push('+++ new')
            const ns = input.new_string.length > 500 ? input.new_string.slice(0, 500) + '...' : input.new_string
            lines.push(ns)
          }
          return lines.join('\n')
        }
        case 'Write': {
          const lines: string[] = []
          if (input.file_path) lines.push(input.file_path)
          if (input.content) {
            const preview = input.content.length > 600 ? input.content.slice(0, 600) + '\n...' : input.content
            lines.push(preview)
          }
          return lines.join('\n')
        }
        case 'Read': {
          return input.file_path || ''
        }
        case 'Bash': {
          return input.command || ''
        }
        case 'Glob': {
          const lines: string[] = []
          if (input.pattern) lines.push(`pattern: ${input.pattern}`)
          if (input.path) lines.push(`path: ${input.path}`)
          return lines.join('\n')
        }
        case 'Grep': {
          const lines: string[] = []
          if (input.pattern) lines.push(`pattern: ${input.pattern}`)
          if (input.path) lines.push(`path: ${input.path}`)
          if (input.glob) lines.push(`glob: ${input.glob}`)
          return lines.join('\n')
        }
        case 'WebFetch':
          return input.url || ''
        case 'WebSearch':
          return input.query || ''
        case 'Task':
          return input.description || input.prompt || ''
        default: {
          // 通用：序列化前 500 字符
          const str = JSON.stringify(input, null, 2)
          return str.length > 500 ? str.slice(0, 500) + '...' : str
        }
      }
    } catch {
      return ''
    }
  }

  private cleanup(sessionId: string) {
    this.processes.delete(sessionId)
    this.thinkingBuffers.delete(sessionId)
    this.lineBuffers.delete(sessionId)
    this.toolBlocks.delete(sessionId)
  }

  cancel(sessionId: string) {
    const proc = this.processes.get(sessionId)
    if (proc) {
      proc.kill()
      this.cleanup(sessionId)
    }
  }

  destroyAll() {
    for (const proc of this.processes.values()) {
      proc.kill()
    }
    this.processes.clear()
    this.thinkingBuffers.clear()
    this.lineBuffers.clear()
    this.sessionIds.clear()
    this.toolBlocks.clear()
  }
}

export const messageRunner = new MessageRunner()
