import { defineStore } from 'pinia'
import { reactive } from 'vue'
import type { MessageBlock, SessionMessages, ExecutionItem, ExecutionType, UsageData } from '../types'
import { ansiToHtml, stripAnsi } from '../services/ansiRenderer'
import { parseExecutions } from '../services/executionParser'
import { renderMarkdown, renderMarkdownFast } from '../services/markdownRenderer'

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 节流渲染管理器 */
const renderTimers = new Map<string, ReturnType<typeof setTimeout>>()
/** 根据内容长度自适应节流间隔 */
function getThrottleInterval(contentLen: number): number {
  if (contentLen < 2000) return 100
  if (contentLen < 8000) return 200
  if (contentLen < 20000) return 350
  return 500
}

export const useChatStore = defineStore('chat', () => {
  const sessionMap = reactive<Map<string, SessionMessages>>(new Map())

  function ensureSession(sessionId: string): SessionMessages {
    if (!sessionMap.has(sessionId)) {
      sessionMap.set(sessionId, {
        sessionId,
        messages: [],
        isWaitingResponse: false,
        streamingMessageId: null,
      })
    }
    return sessionMap.get(sessionId)!
  }

  function getMessages(sessionId: string): MessageBlock[] {
    return sessionMap.get(sessionId)?.messages ?? []
  }

  function isWaiting(sessionId: string): boolean {
    return sessionMap.get(sessionId)?.isWaitingResponse ?? false
  }

  function addUserMessage(sessionId: string, text: string): MessageBlock {
    const session = ensureSession(sessionId)
    const msg: MessageBlock = {
      id: genId('msg'),
      sessionId,
      role: 'user',
      rawContent: text,
      htmlContent: escapeHtml(text),
      executions: [],
      status: 'complete',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    session.messages.push(msg)
    session.isWaitingResponse = true
    return msg
  }

  function addSystemMessage(sessionId: string, text: string): MessageBlock {
    const session = ensureSession(sessionId)
    const msg: MessageBlock = {
      id: genId('msg'),
      sessionId,
      role: 'system',
      rawContent: text,
      htmlContent: ansiToHtml(text),
      executions: [],
      status: 'complete',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    session.messages.push(msg)
    return msg
  }

  function startAssistantMessage(sessionId: string): MessageBlock {
    const session = ensureSession(sessionId)
    const msg: MessageBlock = {
      id: genId('msg'),
      sessionId,
      role: 'assistant',
      rawContent: '',
      htmlContent: '',
      executions: [],
      status: 'streaming',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    session.messages.push(msg)
    session.streamingMessageId = msg.id
    return msg
  }

  function appendToStreaming(sessionId: string, rawChunk: string, toolId?: string): void {
    const session = sessionMap.get(sessionId)
    if (!session?.streamingMessageId) return

    const msg = session.messages.find(m => m.id === session.streamingMessageId)
    if (!msg) return

    msg.rawContent += rawChunk
    msg.updatedAt = Date.now()

    const interval = getThrottleInterval(msg.rawContent.length)

    // 节流渲染：流式期间用轻量渲染器（无代码高亮），自适应间隔
    if (!renderTimers.has(sessionId)) {
      msg.htmlContent = renderMarkdownFast(msg.rawContent)
      renderTimers.set(sessionId, setTimeout(() => {
        renderTimers.delete(sessionId)
        if (msg.status === 'streaming') {
          msg.htmlContent = renderMarkdownFast(msg.rawContent)
        }
      }, interval))
    }

    // 解析执行操作
    if (toolId) {
      const newExecs = parseExecutions(stripAnsi(rawChunk), toolId)
      msg.executions.push(...newExecs)
    }
  }

  function finalizeStreaming(sessionId: string): void {
    const session = sessionMap.get(sessionId)
    if (!session?.streamingMessageId) return

    // 清理节流定时器
    const timer = renderTimers.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      renderTimers.delete(sessionId)
    }

    const msg = session.messages.find(m => m.id === session.streamingMessageId)
    if (msg) {
      // 最终完整 Markdown 渲染（含代码高亮）
      msg.htmlContent = renderMarkdown(msg.rawContent)
      msg.status = 'complete'
      msg.updatedAt = Date.now()
    }
    session.streamingMessageId = null
    session.isWaitingResponse = false
  }

  function addToolUse(sessionId: string, toolUse: { name: string; input?: string; content?: string }): void {
    const session = sessionMap.get(sessionId)
    if (!session?.streamingMessageId) return
    const msg = session.messages.find(m => m.id === session.streamingMessageId)
    if (!msg) return

    // 根据工具名映射为更具体的 execution type
    const typeMap: Record<string, ExecutionType> = {
      Read: 'file_read', Write: 'file_write', Edit: 'file_edit',
      Bash: 'command_run', Glob: 'file_read', Grep: 'file_read',
    }
    const execType: ExecutionType = typeMap[toolUse.name] || 'tool_use'

    // label: 工具名 + 关键详情
    const label = toolUse.input
      ? `${toolUse.name}: ${toolUse.input}`
      : toolUse.name

    msg.executions.push({
      id: genId('exec'),
      type: execType,
      label,
      detail: toolUse.input,
      content: toolUse.content,
      timestamp: Date.now(),
      status: 'success',
    })
  }

  function getFileOps(sessionId: string): ExecutionItem[] {
    return getMessages(sessionId)
      .flatMap(m => m.executions)
      .filter(e => ['file_read', 'file_write', 'file_edit', 'file_delete'].includes(e.type))
  }

  function getToolCalls(sessionId: string): ExecutionItem[] {
    return getMessages(sessionId)
      .flatMap(m => m.executions)
      .filter(e => ['tool_use', 'tool_result'].includes(e.type))
  }

  function getCommands(sessionId: string): ExecutionItem[] {
    return getMessages(sessionId)
      .flatMap(m => m.executions)
      .filter(e => ['command_run', 'command_output'].includes(e.type))
  }

  function clearSession(sessionId: string): void {
    sessionMap.delete(sessionId)
  }

  /** 删除指定消息 */
  function removeMessage(sessionId: string, messageId: string): void {
    const session = sessionMap.get(sessionId)
    if (!session) return
    const idx = session.messages.findIndex(m => m.id === messageId)
    if (idx !== -1) session.messages.splice(idx, 1)
  }

  /** 获取某条 AI 消息前的最后一条用户消息 */
  function getLastUserMessageBefore(sessionId: string, assistantMessageId: string): MessageBlock | null {
    const session = sessionMap.get(sessionId)
    if (!session) return null
    const idx = session.messages.findIndex(m => m.id === assistantMessageId)
    if (idx === -1) return null
    for (let i = idx - 1; i >= 0; i--) {
      if (session.messages[i].role === 'user') return session.messages[i]
    }
    return null
  }

  /** 加载历史消息（从 CLI 工具的 session 文件） */
  function loadHistoryMessages(sessionId: string, messages: { role: 'user' | 'assistant'; content: string; timestamp: string }[]): void {
    const session = ensureSession(sessionId)
    // 如果已经有消息了，不重复加载
    if (session.messages.length > 0) return

    for (const msg of messages) {
      session.messages.push({
        id: genId('msg'),
        sessionId,
        role: msg.role,
        rawContent: msg.content,
        htmlContent: msg.role === 'user' ? escapeHtml(msg.content) : renderMarkdown(msg.content),
        executions: [],
        status: 'complete',
        createdAt: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
        updatedAt: msg.timestamp ? new Date(msg.timestamp).getTime() : Date.now(),
      })
    }
  }

  /** 将 usage 数据附加到当前/最近 assistant 消息 */
  function updateUsage(sessionId: string, usage: UsageData): void {
    const session = sessionMap.get(sessionId)
    if (!session) return
    // 优先用 streamingMessageId 查找，否则回退到最后一条 assistant 消息
    const msg = session.streamingMessageId
      ? session.messages.find(m => m.id === session.streamingMessageId)
      : [...session.messages].reverse().find(m => m.role === 'assistant')
    if (msg) {
      msg.usage = usage
    }
  }

  /** 计算会话累计 token */
  function getSessionUsage(sessionId: string): { totalInput: number; totalOutput: number } {
    const msgs = getMessages(sessionId)
    let totalInput = 0, totalOutput = 0
    for (const m of msgs) {
      if (m.usage) {
        totalInput += m.usage.inputTokens
        totalOutput += m.usage.outputTokens
      }
    }
    return { totalInput, totalOutput }
  }

  return {
    sessionMap,
    ensureSession,
    getMessages,
    isWaiting,
    addUserMessage,
    addSystemMessage,
    startAssistantMessage,
    appendToStreaming,
    finalizeStreaming,
    addToolUse,
    getFileOps,
    getToolCalls,
    getCommands,
    clearSession,
    removeMessage,
    getLastUserMessageBefore,
    loadHistoryMessages,
    updateUsage,
    getSessionUsage,
  }
})
