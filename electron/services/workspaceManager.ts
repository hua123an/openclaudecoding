import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { Workspace } from '../../src/types'

const CONFIG_DIR = path.join(os.homedir(), '.openclaudecoding')
const WORKSPACE_FILE = path.join(CONFIG_DIR, 'workspaces.json')

interface WorkspaceState {
  workspaces: Workspace[]
  activeSessionId: string | null
}

class WorkspaceManager {
  private ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true })
    }
  }

  load(): WorkspaceState {
    try {
      if (fs.existsSync(WORKSPACE_FILE)) {
        const data = fs.readFileSync(WORKSPACE_FILE, 'utf-8')
        return JSON.parse(data)
      }
    } catch {
      // ignore
    }
    return { workspaces: [], activeSessionId: null }
  }

  save(state: WorkspaceState): void {
    this.ensureConfigDir()
    fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(state, null, 2))
  }
}

export const workspaceManager = new WorkspaceManager()
