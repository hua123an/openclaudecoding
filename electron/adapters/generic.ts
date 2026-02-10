import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { CliToolAdapter, StreamEventResult, BuildCommandOpts, CommandResult } from './base'
import type { CliToolInfo } from '../../src/types'
import { shellEscape } from '../services/messageRunner'

/** 图片扩展名 → MIME 映射 */
function getImageMime(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  }
  return map[ext] || 'image/png'
}

export class GenericAdapter implements CliToolAdapter {
  id: string
  name: string
  icon: string
  command: string
  detectCommand: string
  defaultArgs: string[]
  skipConfirmArgs: string[]
  printModeArgs: string[]
  continueArgs: string[]
  resumeArgs: string[]
  outputFormatArgs: string[]
  useStreamJson: boolean
  modelArgs: string[]
  resumeBeforeMessage: boolean
  imagePathArgs: string[]
  /** 思考模式 CLI 参数，如 ['--thinking']，当前各工具为空（预留） */
  thinkingArgs: string[]
  /** stream-json 输入格式参数，如 ['--input-format', 'stream-json'] */
  inputFormatArgs: string[]

  private _installed = false
  private _version = ''
  private _parseStreamEvent: ((line: string) => StreamEventResult | null) | null

  constructor(opts: {
    id: string
    name: string
    icon: string
    command: string
    detectCommand: string
    defaultArgs: string[]
    skipConfirmArgs?: string[]
    printModeArgs?: string[]
    continueArgs?: string[]
    resumeArgs?: string[]
    outputFormatArgs?: string[]
    inputFormatArgs?: string[]
    useStreamJson?: boolean
    modelArgs?: string[]
    resumeBeforeMessage?: boolean
    imagePathArgs?: string[]
    thinkingArgs?: string[]
    parseStreamEvent?: (line: string) => StreamEventResult | null
  }) {
    this.id = opts.id
    this.name = opts.name
    this.icon = opts.icon
    this.command = opts.command
    this.detectCommand = opts.detectCommand
    this.defaultArgs = opts.defaultArgs
    this.skipConfirmArgs = opts.skipConfirmArgs || []
    this.printModeArgs = opts.printModeArgs || []
    this.continueArgs = opts.continueArgs || []
    this.resumeArgs = opts.resumeArgs || []
    this.outputFormatArgs = opts.outputFormatArgs || []
    this.inputFormatArgs = opts.inputFormatArgs || []
    this.useStreamJson = opts.useStreamJson || false
    this.modelArgs = opts.modelArgs || ['--model']
    this.resumeBeforeMessage = opts.resumeBeforeMessage || false
    this.imagePathArgs = opts.imagePathArgs || []
    this.thinkingArgs = opts.thinkingArgs || []
    this._parseStreamEvent = opts.parseStreamEvent || null
  }

  async detect(): Promise<boolean> {
    try {
      const shell = process.env.SHELL || '/bin/zsh'
      // 使用 login shell 确保加载用户 PATH（打包后 Electron 的 PATH 很短）
      const output = execSync(`${shell} -l -c '${this.detectCommand}'`, {
        encoding: 'utf-8',
        timeout: 8000,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, HOME: os.homedir() },
      }).trim()
      this._installed = true
      this._version = output
      return true
    } catch {
      this._installed = false
      this._version = ''
      return false
    }
  }

  async getVersion(): Promise<string> {
    if (!this._version) await this.detect()
    return this._version
  }

  /** 构建单条消息的完整 shell 命令 */
  buildMessageCommand(message: string, opts: BuildCommandOpts): CommandResult {
    const hasImages = opts.imagePaths && opts.imagePaths.length > 0

    // 有图片且支持 stream-json 输入（Claude Code 管道模式）
    if (hasImages && this.inputFormatArgs.length > 0) {
      return this.buildImageCommand(message, opts)
    }

    // 构建命令基础部分
    const parts: string[] = [this.command, ...this.defaultArgs]
    parts.push(...this.printModeArgs)

    // resumeBeforeMessage: resume 参数在 message 之前（Codex: codex exec resume <id> <prompt>）
    if (this.resumeBeforeMessage && opts.cliSessionId && this.resumeArgs.length > 0) {
      parts.push(...this.resumeArgs, opts.cliSessionId)
    }

    parts.push(shellEscape(message))
    parts.push(...this.skipConfirmArgs)

    if (opts.model) {
      parts.push(...this.modelArgs, opts.model)
    }

    // 思考模式参数（预留扩展）
    if (opts.thinking && this.thinkingArgs.length > 0) {
      parts.push(...this.thinkingArgs)
    }

    if (this.outputFormatArgs.length > 0) {
      parts.push(...this.outputFormatArgs)
    }

    // 有图片且支持 imagePathArgs（Codex: -i path1 -i path2）
    if (hasImages && this.imagePathArgs.length > 0) {
      for (const imgPath of opts.imagePaths!) {
        parts.push(...this.imagePathArgs, shellEscape(imgPath))
      }
    }

    // resume 参数在 message 之后（Claude Code / Gemini CLI 等）
    if (!this.resumeBeforeMessage) {
      if (opts.cliSessionId && this.resumeArgs.length > 0) {
        parts.push(...this.resumeArgs, opts.cliSessionId)
      } else if (!opts.isFirst && this.continueArgs.length > 0) {
        parts.push(...this.continueArgs)
      }
    }

    return { command: parts.join(' ') }
  }

  /** 构建带图片的管道命令 */
  private buildImageCommand(message: string, opts: BuildCommandOpts): CommandResult {
    // 构建 content blocks
    const content: any[] = []

    for (const imgPath of opts.imagePaths!) {
      if (!fs.existsSync(imgPath)) {
        console.warn('[adapter] image file not found, skipping:', imgPath)
        continue
      }
      try {
        const data = fs.readFileSync(imgPath)
        const base64 = data.toString('base64')
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: getImageMime(imgPath),
            data: base64,
          },
        })
      } catch (err) {
        console.warn('[adapter] failed to read image:', imgPath, err)
      }
    }

    content.push({ type: 'text', text: message })

    const inputJson = JSON.stringify({
      role: 'user',
      content,
    })

    // 写入临时文件
    const tempFile = path.join(os.tmpdir(), `opencoding_${Date.now()}_${Math.random().toString(36).slice(2)}.json`)
    fs.writeFileSync(tempFile, inputJson, 'utf-8')

    // 构建管道命令：不用 -p（避免它吞掉下一个参数当 prompt），用 --print 代替
    const parts: string[] = ['cat', shellEscape(tempFile), '|', this.command, ...this.defaultArgs]
    parts.push('--print')
    parts.push(...this.skipConfirmArgs)
    parts.push(...this.inputFormatArgs)

    if (opts.model) {
      parts.push(...this.modelArgs, opts.model)
    }

    // 思考模式参数（预留扩展）
    if (opts.thinking && this.thinkingArgs.length > 0) {
      parts.push(...this.thinkingArgs)
    }

    if (this.outputFormatArgs.length > 0) {
      parts.push(...this.outputFormatArgs)
    }

    if (opts.cliSessionId && this.resumeArgs.length > 0) {
      parts.push(...this.resumeArgs, opts.cliSessionId)
    } else if (!opts.isFirst && this.continueArgs.length > 0) {
      parts.push(...this.continueArgs)
    }

    return { command: parts.join(' '), tempFile }
  }

  /** 解析 stream-json 的一行 */
  parseStreamEvent(line: string): StreamEventResult | null {
    if (this._parseStreamEvent) {
      return this._parseStreamEvent(line)
    }
    return null
  }

  getInfo(): CliToolInfo {
    return {
      id: this.id,
      name: this.name,
      icon: this.icon,
      command: this.command,
      detectCommand: this.detectCommand,
      defaultArgs: this.defaultArgs,
      installed: this._installed,
      version: this._version,
    }
  }
}
