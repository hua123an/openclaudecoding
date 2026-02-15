import { ipcMain, dialog, BrowserWindow, shell } from 'electron'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { ptyManager } from '../pty/ptyManager'
import { toolDetector } from '../services/toolDetector'
import { projectManager } from '../services/projectManager'
import { workspaceManager } from '../services/workspaceManager'
import { settingsManager } from '../services/settingsManager'
import { messageRunner } from '../services/messageRunner'
import { listCliSessions, loadCliSessionMessages } from '../services/sessionList'
import { allAdapters } from '../adapters'

export function registerIpcHandlers(): void {
  // ===== PTY (保留用于未来可能的交互模式回退) =====
  ipcMain.handle('pty:create', (event, opts: any) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    ptyManager.create(
      opts,
      (data) => {
        win?.webContents.send(`pty:data:${opts.sessionId}`, data)
      },
      (code) => {
        win?.webContents.send(`pty:exit:${opts.sessionId}`, code)
      }
    )
    return { success: true }
  })

  ipcMain.handle('pty:write', (_event, sessionId: string, data: string) => {
    ptyManager.write(sessionId, data)
    return { success: true }
  })

  ipcMain.handle('pty:resize', (_event, opts: any) => {
    ptyManager.resize(opts)
    return { success: true }
  })

  ipcMain.handle('pty:destroy', (_event, sessionId: string) => {
    ptyManager.destroy(sessionId)
    return { success: true }
  })

  // ===== Message (命令模式：每条消息 spawn 一次进程) =====
  ipcMain.handle('message:send', (event, opts: {
    sessionId: string
    toolId: string
    projectDir: string
    message: string
    isFirst: boolean
    cliSessionId?: string
    imagePaths?: string[]
    model?: string
    thinking?: boolean
  }) => {
    const adapter = allAdapters.find((a) => a.id === opts.toolId)
    if (!adapter) return { success: false, error: 'Tool not found' }

    const result = adapter.buildMessageCommand(opts.message, {
      isFirst: opts.isFirst,
      cliSessionId: opts.cliSessionId,
      imagePaths: opts.imagePaths,
      model: opts.model,
      thinking: opts.thinking,
    })
    const win = BrowserWindow.fromWebContents(event.sender)
    /** 安全发送 IPC（窗口可能已销毁） */
    const safeSend = (channel: string, data: any) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    }

    console.log('[message:send]', opts.isFirst ? 'first' : 'continue',
      'cliSessionId:', opts.cliSessionId || '(none)',
      'cmd:', result.command, 'cwd:', opts.projectDir)

    messageRunner.send({
      sessionId: opts.sessionId,
      command: result.command,
      cwd: opts.projectDir,
      streamJson: adapter.useStreamJson,
      parseStreamEvent: adapter.useStreamJson
        ? (line) => adapter.parseStreamEvent(line)
        : undefined,
      tempFile: result.tempFile,
      onData: (data) => {
        safeSend(`message:data:${opts.sessionId}`, data)
      },
      onSessionId: (sessionId) => {
        safeSend(`message:sessionId:${opts.sessionId}`, sessionId)
      },
      onToolUse: (toolUse) => {
        safeSend(`message:tool-use:${opts.sessionId}`, toolUse)
      },
      onUsage: (usage) => {
        safeSend(`message:usage:${opts.sessionId}`, usage)
      },
      onDone: (code) => {
        safeSend(`message:done:${opts.sessionId}`, code)
      },
      onError: (error) => {
        safeSend(`message:error:${opts.sessionId}`, error)
      },
    })

    return { success: true }
  })

  ipcMain.handle('message:cancel', (_event, sessionId: string) => {
    messageRunner.cancel(sessionId)
    return { success: true }
  })

  // ===== CLI Session 列表 =====
  ipcMain.handle('session:list-cli', async (_event, opts: { toolId: string; projectPath: string }) => {
    return await listCliSessions(opts.toolId, opts.projectPath)
  })

  ipcMain.handle('session:load-messages', async (_event, opts: { toolId: string; projectPath: string; cliSessionId: string }) => {
    return await loadCliSessionMessages(opts.toolId, opts.projectPath, opts.cliSessionId)
  })

  // ===== Tool =====
  ipcMain.handle('tool:list', async () => {
    return toolDetector.getToolList()
  })

  ipcMain.handle('tool:detect-all', async () => {
    return await toolDetector.detectAll()
  })

  ipcMain.handle('tool:detect', async (_event, toolId: string) => {
    return await toolDetector.detectOne(toolId)
  })

  // ===== Image Dialog =====
  ipcMain.handle('dialog:open-images', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      title: '选择图片',
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] },
      ],
    })
    if (result.canceled || result.filePaths.length === 0) return []
    return result.filePaths
  })

  // 保存剪贴板粘贴的图片（base64 → 临时文件）
  ipcMain.handle('clipboard:save-image', (_event, data: string, mimeType: string) => {
    const extMap: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/bmp': '.bmp',
    }
    const ext = extMap[mimeType] || '.png'
    const tempFile = path.join(os.tmpdir(), `opencoding_paste_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`)
    fs.writeFileSync(tempFile, Buffer.from(data, 'base64'))
    return tempFile
  })

  // ===== File System（自定义文件浏览器） =====
  ipcMain.handle('fs:home-dir', () => {
    return os.homedir()
  })

  ipcMain.handle('fs:read-dir', async (_event, dirPath: string) => {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      const items: { name: string; path: string; isDirectory: boolean; size: number; mtime: number }[] = []
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue // 隐藏文件
        const fullPath = path.join(dirPath, entry.name)
        try {
          const stat = fs.statSync(fullPath)
          items.push({
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            size: stat.size,
            mtime: stat.mtimeMs,
          })
        } catch {
          // 无权限等情况，跳过
        }
      }
      // 文件夹优先，同类按名称排序
      items.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      return items
    } catch (err: any) {
      return { error: err.message }
    }
  })

  // ===== Project =====
  ipcMain.handle('project:open-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择项目目录',
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const dir = result.filePaths[0]
    projectManager.addRecent(dir)
    return dir
  })

  ipcMain.handle('project:recent', () => {
    return projectManager.getRecent()
  })

  ipcMain.handle('project:add-recent', (_event, projectPath: string) => {
    projectManager.addRecent(projectPath)
    return { success: true }
  })

  ipcMain.handle('project:remove-recent', (_event, projectPath: string) => {
    projectManager.removeRecent(projectPath)
    return { success: true }
  })

  // ===== Workspace Persistence =====
  ipcMain.handle('workspace:load', () => {
    return workspaceManager.load()
  })

  ipcMain.handle('workspace:save', (_event, state: any) => {
    workspaceManager.save(state)
    return { success: true }
  })

  // ===== Settings Persistence =====
  ipcMain.handle('settings:load', () => {
    return settingsManager.load()
  })

  ipcMain.handle('settings:save', (_event, state: any) => {
    settingsManager.save(state)
    return { success: true }
  })

  // ===== Shell（外部链接） =====
  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    await shell.openExternal(url)
    return { success: true }
  })

  // ===== Plugin 管理 =====

  // 读取 Claude Code settings.json
  ipcMain.handle('claude:read-settings', async () => {
    try {
      const settingsPath = path.join(os.homedir(), '.claude', 'settings.json')
      const content = fs.readFileSync(settingsPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return {}
    }
  })

  // 动态获取模型列表（从 API base_url/v1/models）
  ipcMain.handle('model:list', async () => {
    try {
      const settingsPath = path.join(os.homedir(), '.claude', 'settings.json')
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
      const baseUrl = settings?.env?.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'
      const apiKey = settings?.env?.ANTHROPIC_AUTH_TOKEN || settings?.env?.ANTHROPIC_API_KEY || ''
      if (!apiKey) return []

      const url = `${baseUrl.replace(/\/$/, '')}/v1/models`
      const resp = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      })
      if (!resp.ok) {
        console.warn('[model:list] API responded', resp.status)
        return []
      }
      const body = await resp.json() as any
      // OpenAI 兼容格式: { data: [{ id, ... }] }
      if (body?.data && Array.isArray(body.data)) {
        return body.data.map((m: any) => ({
          id: m.id,
          name: m.display_name || m.name || m.id,
          created: m.created_at || m.created || '',
        }))
      }
      return []
    } catch (err: any) {
      console.warn('[model:list] fetch failed:', err.message)
      return []
    }
  })

  /** 解析 markdown 文件的 YAML frontmatter */
  function parseYamlFrontmatter(content: string): Record<string, string> {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!match) return {}
    const result: Record<string, string> = {}
    for (const line of match[1].split('\n')) {
      const idx = line.indexOf(':')
      if (idx === -1) continue
      const key = line.slice(0, idx).trim()
      const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      if (key && val) result[key] = val
    }
    return result
  }

  /** 安全执行 CLI 命令 */
  function execCli(cmd: string, timeout = 10000): string {
    try {
      return execSync(cmd, {
        encoding: 'utf-8',
        timeout,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, HOME: os.homedir() },
      }).trim()
    } catch (err: any) {
      console.warn('[plugin handler] exec failed:', cmd, err.message)
      return ''
    }
  }

  // 获取已安装插件列表
  ipcMain.handle('plugin:list', async () => {
    const output = execCli('claude plugin list --json')
    if (!output) return []
    try {
      const plugins = JSON.parse(output)
      // 尝试读取每个插件的 plugin.json 获取 description/author
      for (const p of plugins) {
        if (p.installPath) {
          try {
            const manifest = JSON.parse(
              fs.readFileSync(path.join(p.installPath, '.claude-plugin', 'plugin.json'), 'utf-8')
            )
            p.description = manifest.description || ''
            p.author = manifest.author || ''
          } catch {}
        }
      }
      return plugins
    } catch {
      return []
    }
  })

  // 获取市场插件列表
  ipcMain.handle('plugin:marketplace-list', async () => {
    const output = execCli('claude plugin marketplace list --json')
    if (!output) return []
    try {
      return JSON.parse(output)
    } catch {
      return []
    }
  })

  // 安装插件
  ipcMain.handle('plugin:install', async (_event, name: string) => {
    const output = execCli(`claude plugin install ${name}`, 30000)
    return { success: !!output, message: output }
  })

  // 卸载插件
  ipcMain.handle('plugin:uninstall', async (_event, name: string) => {
    const output = execCli(`claude plugin uninstall ${name}`)
    return { success: true, message: output }
  })

  // 启用/禁用插件
  ipcMain.handle('plugin:toggle', async (_event, name: string, enable: boolean) => {
    const cmd = enable ? 'enable' : 'disable'
    const output = execCli(`claude plugin ${cmd} ${name}`)
    return { success: true, message: output }
  })

  // 获取可用 skills（从已安装插件的 commands/*.md）
  ipcMain.handle('plugin:list-skills', async () => {
    const output = execCli('claude plugin list --json')
    if (!output) return []

    try {
      const plugins = JSON.parse(output)
      const skills: any[] = []

      for (const plugin of plugins) {
        if (!plugin.enabled || !plugin.installPath) continue

        const commandsDir = path.join(plugin.installPath, 'commands')
        if (!fs.existsSync(commandsDir)) continue

        const files = fs.readdirSync(commandsDir).filter((f: string) => f.endsWith('.md'))
        for (const file of files) {
          try {
            const content = fs.readFileSync(path.join(commandsDir, file), 'utf-8')
            const fm = parseYamlFrontmatter(content)
            const name = file.replace(/\.md$/, '')
            skills.push({
              id: `${plugin.name || plugin.id}/${name}`,
              name,
              pluginName: plugin.name || plugin.id || 'unknown',
              description: fm.description || '',
              argumentHint: fm['argument-hint'] || undefined,
            })
          } catch {}
        }
      }

      return skills
    } catch {
      return []
    }
  })
}
