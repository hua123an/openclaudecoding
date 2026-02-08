import * as pty from 'node-pty'
import os from 'node:os'
import type { PtyCreateOptions, PtyResizeOptions } from '../../src/types'

const shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/zsh'

interface PtyInstance {
  process: pty.IPty
  sessionId: string
}

class PtyManager {
  private instances = new Map<string, PtyInstance>()

  create(opts: PtyCreateOptions, onData: (data: string) => void, onExit: (code: number) => void): void {
    if (this.instances.has(opts.sessionId)) {
      this.destroy(opts.sessionId)
    }

    const useCommand = opts.command || shell
    const useArgs = opts.command ? (opts.args || []) : ['-l']

    console.log('[pty] spawn:', useCommand, useArgs, 'cwd:', opts.cwd)

    const ptyProcess = pty.spawn(useCommand, useArgs, {
      name: 'xterm-256color',
      cols: opts.cols || 120,
      rows: opts.rows || 30,
      cwd: opts.cwd || os.homedir(),
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
      } as Record<string, string>,
    })

    ptyProcess.onData(onData)
    ptyProcess.onExit(({ exitCode }) => onExit(exitCode))

    this.instances.set(opts.sessionId, {
      process: ptyProcess,
      sessionId: opts.sessionId,
    })
  }

  write(sessionId: string, data: string): void {
    const instance = this.instances.get(sessionId)
    if (instance) {
      instance.process.write(data)
    }
  }

  resize(opts: PtyResizeOptions): void {
    const instance = this.instances.get(opts.sessionId)
    if (instance) {
      instance.process.resize(opts.cols, opts.rows)
    }
  }

  destroy(sessionId: string): void {
    const instance = this.instances.get(sessionId)
    if (instance) {
      instance.process.kill()
      this.instances.delete(sessionId)
    }
  }

  destroyAll(): void {
    for (const [id] of this.instances) {
      this.destroy(id)
    }
  }

  has(sessionId: string): boolean {
    return this.instances.has(sessionId)
  }
}

export const ptyManager = new PtyManager()
