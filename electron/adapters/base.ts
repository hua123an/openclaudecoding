import type { CliToolInfo } from '../../src/types'

/** stream-json 单行解析结果 */
export interface StreamEventResult {
  text?: string
  sessionId?: string
}

export interface BuildCommandOpts {
  isFirst: boolean
  cliSessionId?: string
  imagePaths?: string[]
  model?: string
  thinking?: boolean
}

/** buildMessageCommand 返回值：命令 + 可选临时文件路径 */
export interface CommandResult {
  command: string
  tempFile?: string
}

export interface CliToolAdapter {
  id: string
  name: string
  icon: string
  command: string
  detectCommand: string
  defaultArgs: string[]
  /** 跳过交互确认的参数 */
  skipConfirmArgs: string[]
  /** 非交互/打印模式参数，如 ['-p'] */
  printModeArgs: string[]
  /** 续接上一次对话的参数，如 ['-c'] */
  continueArgs: string[]
  /** 恢复指定会话的参数前缀，如 ['--resume'] */
  resumeArgs: string[]
  /** 输出格式参数，如 ['--output-format', 'stream-json'] */
  outputFormatArgs: string[]
  /** 是否使用 stream-json 模式（需解析 JSON 行） */
  useStreamJson: boolean
  /** 模型选择参数前缀，如 ['--model'] 或 ['-m']，默认 ['--model'] */
  modelArgs: string[]
  /** resume 时 sessionId 放在 message 之前（Codex: codex exec resume <id> <prompt>） */
  resumeBeforeMessage: boolean
  /** 直接图片路径参数，如 ['-i']（Codex 用 -i path） */
  imagePathArgs: string[]
  /** 思考模式 CLI 参数，如 ['--thinking']，当前各工具为空（预留） */
  thinkingArgs: string[]

  detect(): Promise<boolean>
  getVersion(): Promise<string>
  /** 构建单条消息的完整 shell 命令（可能包含临时文件） */
  buildMessageCommand(message: string, opts: BuildCommandOpts): CommandResult
  /** 解析 stream-json 的一行，返回文本和/或 sessionId */
  parseStreamEvent(line: string): StreamEventResult | null
  getInfo(): CliToolInfo
}
