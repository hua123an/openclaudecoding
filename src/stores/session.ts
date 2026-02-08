import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Session, Workspace, CliToolInfo } from '../types'
import { useChatStore } from './chat'

export const useSessionStore = defineStore('session', () => {
  // === Workspaces ===
  const workspaces = ref<Workspace[]>([])
  const activeSessionId = ref<string | null>(null)
  let _initialized = false
  let _saveTimer: ReturnType<typeof setTimeout> | null = null

  const activeSession = computed(() => {
    for (const ws of workspaces.value) {
      const s = ws.sessions.find((s) => s.id === activeSessionId.value)
      if (s) return s
    }
    return null
  })

  const activeWorkspace = computed(() => {
    if (!activeSession.value) return null
    return workspaces.value.find((ws) =>
      ws.sessions.some((s) => s.id === activeSessionId.value)
    ) || null
  })

  /** 从磁盘加载持久化状态 */
  async function init() {
    if (_initialized) return
    _initialized = true
    try {
      const state = await window.electronAPI.workspaceLoad()
      if (state.workspaces.length > 0) {
        workspaces.value = state.workspaces
        activeSessionId.value = state.activeSessionId
      }
    } catch (err) {
      console.warn('[session store] failed to load workspace state:', err)
    }
  }

  /** 防抖保存到磁盘 */
  function scheduleSave() {
    if (!_initialized) return
    if (_saveTimer) clearTimeout(_saveTimer)
    _saveTimer = setTimeout(() => {
      window.electronAPI.workspaceSave({
        workspaces: JSON.parse(JSON.stringify(workspaces.value)),
        activeSessionId: activeSessionId.value,
      })
    }, 300)
  }

  // 监听状态变化，自动持久化
  watch([workspaces, activeSessionId], () => {
    scheduleSave()
  }, { deep: true })

  /** 获取或创建一个 workspace */
  function ensureWorkspace(projectPath: string): Workspace {
    let ws = workspaces.value.find((w) => w.path === projectPath)
    if (!ws) {
      ws = {
        path: projectPath,
        name: projectPath.split('/').pop() || projectPath,
        expanded: true,
        sessions: [],
        lastOpened: Date.now(),
      }
      workspaces.value.push(ws)
    }
    return ws
  }

  function createSession(toolId: string, projectPath: string, title?: string, cliSessionId?: string): Session {
    const ws = ensureWorkspace(projectPath)
    const tool = tools.value.find((t) => t.id === toolId)
    const session: Session = {
      id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      toolId,
      projectPath,
      title: title || `New ${tool?.name || 'Session'}`,
      cliSessionId,
      createdAt: Date.now(),
    }
    ws.sessions.push(session)
    ws.expanded = true
    ws.lastOpened = Date.now()
    activeSessionId.value = session.id
    return session
  }

  /** 加载项目下某个 CLI 工具的历史 session 列表 */
  async function loadCliSessions(toolId: string, projectPath: string) {
    try {
      const cliSessions = await window.electronAPI.listCliSessions({ toolId, projectPath })
      if (cliSessions.length === 0) return

      const ws = ensureWorkspace(projectPath)

      // 已经存在的 cliSessionId 集合，避免重复
      const existingIds = new Set(
        ws.sessions.filter(s => s.cliSessionId).map(s => s.cliSessionId)
      )

      for (const cs of cliSessions) {
        if (existingIds.has(cs.sessionId)) continue

        ws.sessions.push({
          id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          toolId,
          projectPath,
          title: cs.title,
          cliSessionId: cs.sessionId,
          createdAt: new Date(cs.timestamp).getTime() || Date.now(),
        })
      }

      ws.expanded = true
      ws.lastOpened = Date.now()
    } catch (err) {
      console.warn('[session store] failed to load CLI sessions:', err)
    }
  }

  function removeSession(sessionId: string) {
    const chatStore = useChatStore()
    for (const ws of workspaces.value) {
      const idx = ws.sessions.findIndex((s) => s.id === sessionId)
      if (idx !== -1) {
        ws.sessions.splice(idx, 1)
        window.electronAPI.messageCancel(sessionId)
        chatStore.clearSession(sessionId)

        if (activeSessionId.value === sessionId) {
          const next = ws.sessions[Math.max(0, idx - 1)]
          if (next) {
            activeSessionId.value = next.id
          } else {
            const allSessions = workspaces.value.flatMap((w) => w.sessions)
            activeSessionId.value = allSessions.length > 0 ? allSessions[allSessions.length - 1].id : null
          }
        }
        break
      }
    }
  }

  function removeWorkspace(path: string) {
    const chatStore = useChatStore()
    const ws = workspaces.value.find((w) => w.path === path)
    if (!ws) return
    for (const s of ws.sessions) {
      window.electronAPI.messageCancel(s.id)
      chatStore.clearSession(s.id)
    }
    workspaces.value = workspaces.value.filter((w) => w.path !== path)
    if (activeSession.value && activeSession.value.projectPath === path) {
      const allSessions = workspaces.value.flatMap((w) => w.sessions)
      activeSessionId.value = allSessions.length > 0 ? allSessions[allSessions.length - 1].id : null
    }
  }

  function toggleWorkspace(path: string) {
    const ws = workspaces.value.find((w) => w.path === path)
    if (ws) ws.expanded = !ws.expanded
  }

  function setActive(sessionId: string) {
    activeSessionId.value = sessionId
    for (const ws of workspaces.value) {
      if (ws.sessions.some((s) => s.id === sessionId)) {
        ws.expanded = true
        break
      }
    }
  }

  function renameSession(sessionId: string, newTitle: string) {
    for (const ws of workspaces.value) {
      const s = ws.sessions.find((s) => s.id === sessionId)
      if (s) {
        s.title = newTitle
        break
      }
    }
  }

  /** 更新 CLI 工具的 session ID */
  function updateCliSessionId(sessionId: string, cliSessionId: string) {
    for (const ws of workspaces.value) {
      const s = ws.sessions.find((s) => s.id === sessionId)
      if (s) {
        s.cliSessionId = cliSessionId
        break
      }
    }
  }

  // === Tools ===
  const tools = ref<CliToolInfo[]>([])

  async function loadTools() {
    tools.value = await window.electronAPI.toolList()
  }

  async function detectTools() {
    const results = await window.electronAPI.toolDetectAll()
    for (const result of results) {
      const tool = tools.value.find((t) => t.id === result.id)
      if (tool) {
        tool.installed = result.installed
        tool.version = result.version
      }
    }
  }

  const installedTools = computed(() => tools.value.filter((t) => t.installed))

  return {
    workspaces,
    activeSessionId,
    activeSession,
    activeWorkspace,
    init,
    ensureWorkspace,
    createSession,
    loadCliSessions,
    removeSession,
    removeWorkspace,
    toggleWorkspace,
    setActive,
    renameSession,
    updateCliSessionId,
    tools,
    installedTools,
    loadTools,
    detectTools,
  }
})
