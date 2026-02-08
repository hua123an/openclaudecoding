import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { ProjectInfo } from '../../src/types'

const CONFIG_DIR = path.join(os.homedir(), '.openclaudecoding')
const RECENT_FILE = path.join(CONFIG_DIR, 'recent-projects.json')

class ProjectManager {
  private recentProjects: ProjectInfo[] = []

  constructor() {
    this.loadRecent()
  }

  private ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true })
    }
  }

  private loadRecent(): void {
    try {
      if (fs.existsSync(RECENT_FILE)) {
        const data = fs.readFileSync(RECENT_FILE, 'utf-8')
        this.recentProjects = JSON.parse(data)
      }
    } catch {
      this.recentProjects = []
    }
  }

  private saveRecent(): void {
    this.ensureConfigDir()
    fs.writeFileSync(RECENT_FILE, JSON.stringify(this.recentProjects, null, 2))
  }

  addRecent(projectPath: string): void {
    this.recentProjects = this.recentProjects.filter((p) => p.path !== projectPath)
    this.recentProjects.unshift({
      path: projectPath,
      name: path.basename(projectPath),
      lastOpened: Date.now(),
    })
    if (this.recentProjects.length > 20) {
      this.recentProjects = this.recentProjects.slice(0, 20)
    }
    this.saveRecent()
  }

  getRecent(): ProjectInfo[] {
    return this.recentProjects
  }

  removeRecent(projectPath: string): void {
    this.recentProjects = this.recentProjects.filter((p) => p.path !== projectPath)
    this.saveRecent()
  }
}

export const projectManager = new ProjectManager()
