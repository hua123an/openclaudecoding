/** CLI 工具适配器定义 */
export interface CliToolInfo {
  id: string
  name: string
  icon: string
  command: string
  detectCommand: string
  defaultArgs: string[]
  installed: boolean
  version: string
}

/** 会话状态 */
export interface Session {
  id: string
  toolId: string
  projectPath: string
  title: string
  cliSessionId?: string    // CLI 工具自己的 session ID
  createdAt: number
}

/** 工作区/项目（包含会话列表） */
export interface Workspace {
  path: string
  name: string
  expanded: boolean
  sessions: Session[]
  lastOpened: number
}

/** 项目信息（持久化用） */
export interface ProjectInfo {
  path: string
  name: string
  lastOpened: number
}

/** PTY 创建参数 */
export interface PtyCreateOptions {
  sessionId: string
  command: string
  args: string[]
  cwd: string
  cols: number
  rows: number
}

/** PTY 调整大小参数 */
export interface PtyResizeOptions {
  sessionId: string
  cols: number
  rows: number
}

/** 工具检测结果 */
export interface ToolDetectResult {
  id: string
  installed: boolean
  version: string
}

// ===== Chat UI 类型 =====

/** 消息角色 */
export type MessageRole = 'user' | 'assistant' | 'system'

/** 消息状态 */
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error'

/** 执行操作类型 */
export type ExecutionType =
  | 'file_read' | 'file_write' | 'file_edit' | 'file_delete'
  | 'tool_use' | 'tool_result'
  | 'command_run' | 'command_output'

/** 单个执行操作 */
export interface ExecutionItem {
  id: string
  type: ExecutionType
  label: string
  detail?: string
  timestamp: number
  status: 'running' | 'success' | 'error'
}

/** 消息块 */
export interface MessageBlock {
  id: string
  sessionId: string
  role: MessageRole
  rawContent: string
  htmlContent: string
  executions: ExecutionItem[]
  status: MessageStatus
  createdAt: number
  updatedAt: number
}

/** 会话消息集合 */
export interface SessionMessages {
  sessionId: string
  messages: MessageBlock[]
  isWaitingResponse: boolean
  streamingMessageId: string | null
}

// ===== 模型切换 =====

/** Claude 模型选项 */
export interface ModelOption {
  id: string        // 'sonnet' | 'opus' | 'haiku' 或完整 model ID
  label: string     // 显示名
  description?: string
}

// ===== Skills (Slash Commands) =====

/** 插件 Skill 条目 */
export interface SkillItem {
  id: string          // 'plugin-name/command-name'
  name: string        // command 名称（不含 .md）
  pluginName: string  // 所属插件名
  description: string
  argumentHint?: string
}

// ===== 插件系统 =====

/** 已安装插件信息 */
export interface PluginInfo {
  id: string
  name: string
  version: string
  scope: string         // 'user' | 'project' | 'local'
  enabled: boolean
  installPath: string
  description?: string
  author?: string
}

/** 市场插件信息 */
export interface MarketplacePlugin {
  name: string
  source: string
  repo?: string
  description?: string
}
