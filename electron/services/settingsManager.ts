import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const CONFIG_DIR = path.join(os.homedir(), '.openclaudecoding')
const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json')

export interface SettingsState {
  theme: 'dark' | 'light'
  fontSize: number
  fontFamily: string
  selectedModels: Record<string, string>
  thinkingMode: boolean
}

const DEFAULT_SETTINGS: SettingsState = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace",
  selectedModels: {
    'claude-code': 'sonnet',
    'gemini-cli': 'gemini-2.5-pro',
    'codex': 'o3',
    'copilot': 'claude-sonnet-4',
  },
  thinkingMode: false,
}

class SettingsManager {
  private ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true })
    }
  }

  load(): SettingsState {
    try {
      if (fs.existsSync(SETTINGS_FILE)) {
        const data = fs.readFileSync(SETTINGS_FILE, 'utf-8')
        const parsed = JSON.parse(data)
        // 合并默认值，防止旧版本缺少新字段
        return { ...DEFAULT_SETTINGS, ...parsed }
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_SETTINGS }
  }

  save(state: SettingsState): void {
    this.ensureConfigDir()
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(state, null, 2))
  }
}

export const settingsManager = new SettingsManager()
