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

  private cleanup(sessionId: string) {
    this.processes.delete(sessionId)
    this.thinkingBuffers.delete(sessionId)
    this.lineBuffers.delete(sessionId)
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
  }
}

export const messageRunner = new MessageRunner()
