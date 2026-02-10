import { ipcRenderer, contextBridge } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // ===== Message（命令模式） =====
  messageSend: (opts: { sessionId: string; toolId: string; projectDir: string; message: string; isFirst: boolean; cliSessionId?: string; imagePaths?: string[]; model?: string }) =>
    ipcRenderer.invoke('message:send', opts),
  messageCancel: (sessionId: string) =>
    ipcRenderer.invoke('message:cancel', sessionId),
  onMessageData: (sessionId: string, callback: (data: string) => void) => {
    const channel = `message:data:${sessionId}`
    const handler = (_event: any, data: string) => callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  onMessageSessionId: (sessionId: string, callback: (cliSessionId: string) => void) => {
    const channel = `message:sessionId:${sessionId}`
    const handler = (_event: any, cliSessionId: string) => callback(cliSessionId)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  onMessageDone: (sessionId: string, callback: (code: number) => void) => {
    const channel = `message:done:${sessionId}`
    const handler = (_event: any, code: number) => callback(code)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  onMessageError: (sessionId: string, callback: (error: string) => void) => {
    const channel = `message:error:${sessionId}`
    const handler = (_event: any, error: string) => callback(error)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  onMessageToolUse: (sessionId: string, callback: (toolUse: { name: string; input?: string; content?: string }) => void) => {
    const channel = `message:tool-use:${sessionId}`
    const handler = (_event: any, toolUse: any) => callback(toolUse)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  // ===== Shell（外部链接） =====
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),

  // ===== Image Dialog =====
  openImageDialog: () => ipcRenderer.invoke('dialog:open-images') as Promise<string[]>,
  saveClipboardImage: (base64: string, mimeType: string) =>
    ipcRenderer.invoke('clipboard:save-image', base64, mimeType) as Promise<string>,

  // ===== PTY（保留） =====
  ptyCreate: (opts: any) => ipcRenderer.invoke('pty:create', opts),
  ptyWrite: (sessionId: string, data: string) => ipcRenderer.invoke('pty:write', sessionId, data),
  ptyResize: (opts: any) => ipcRenderer.invoke('pty:resize', opts),
  ptyDestroy: (sessionId: string) => ipcRenderer.invoke('pty:destroy', sessionId),
  onPtyData: (sessionId: string, callback: (data: string) => void) => {
    const channel = `pty:data:${sessionId}`
    const handler = (_event: any, data: string) => callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },
  onPtyExit: (sessionId: string, callback: (code: number) => void) => {
    const channel = `pty:exit:${sessionId}`
    const handler = (_event: any, code: number) => callback(code)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  // ===== CLI Session 列表 =====
  listCliSessions: (opts: { toolId: string; projectPath: string }) =>
    ipcRenderer.invoke('session:list-cli', opts),
  loadCliSessionMessages: (opts: { toolId: string; projectPath: string; cliSessionId: string }) =>
    ipcRenderer.invoke('session:load-messages', opts),

  // ===== Tool =====
  toolList: () => ipcRenderer.invoke('tool:list'),
  toolDetectAll: () => ipcRenderer.invoke('tool:detect-all'),
  toolDetect: (toolId: string) => ipcRenderer.invoke('tool:detect', toolId),

  // ===== Project =====
  projectOpenDialog: () => ipcRenderer.invoke('project:open-dialog'),
  projectRecent: () => ipcRenderer.invoke('project:recent'),
  projectAddRecent: (path: string) => ipcRenderer.invoke('project:add-recent', path),
  projectRemoveRecent: (path: string) => ipcRenderer.invoke('project:remove-recent', path),

  // ===== Workspace Persistence =====
  workspaceLoad: () => ipcRenderer.invoke('workspace:load'),
  workspaceSave: (state: any) => ipcRenderer.invoke('workspace:save', state),

  // ===== Claude Settings =====
  readClaudeSettings: () => ipcRenderer.invoke('claude:read-settings'),
  listModels: () => ipcRenderer.invoke('model:list'),

  // ===== Plugin 管理 =====
  pluginList: () => ipcRenderer.invoke('plugin:list'),
  pluginMarketplaceList: () => ipcRenderer.invoke('plugin:marketplace-list'),
  pluginInstall: (name: string) => ipcRenderer.invoke('plugin:install', name),
  pluginUninstall: (name: string) => ipcRenderer.invoke('plugin:uninstall', name),
  pluginToggle: (name: string, enable: boolean) => ipcRenderer.invoke('plugin:toggle', name, enable),
  listSkills: () => ipcRenderer.invoke('plugin:list-skills'),
})
