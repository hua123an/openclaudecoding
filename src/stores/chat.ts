import { defineStore } from 'pinia'
import { reactive } from 'vue'
import type { MessageBlock, SessionMessages, ExecutionItem } from '../types'
import { ansiToHtml, stripAnsi } from '../services/ansiRenderer'
import { parseExecutions } from '../services/executionParser'
import { renderMarkdown } from '../services/markdownRenderer'

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** 轻量 HTML 转换：流式期间用，不做代码高亮 */
function lightHtml(raw: string): string {
  const cleaned = stripAnsi(raw)
  return escapeHtml(cleaned)
    .replace(/\n/g, '<br>')
}

/** 节流渲染管理器 */
const renderTimers = new Map<string, ReturnType<typeof setTimeout>>()
const RENDER_INTERVAL = 150 // ms

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

    // 立即用轻量渲染更新（无代码高亮，极快）
    msg.htmlContent = lightHtml(msg.rawContent)

    // 节流：每 150ms 做一次完整 Markdown 渲染
    if (!renderTimers.has(sessionId)) {
      renderTimers.set(sessionId, setTimeout(() => {
        renderTimers.delete(sessionId)
        if (msg.status === 'streaming') {
          msg.htmlContent = renderMarkdown(msg.rawContent)
        }
      }, RENDER_INTERVAL))
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
    getFileOps,
    getToolCalls,
    getCommands,
    clearSession,
    loadHistoryMessages,
  }
})
