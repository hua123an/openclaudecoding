<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import ChatView from '../chat/ChatView.vue'
import ExecutionPanel from '../execution/ExecutionPanel.vue'
import { useChatStore } from '../../stores/chat'
import { useSessionStore } from '../../stores/session'
import { useSettingsStore } from '../../stores/settings'

const props = defineProps<{
  sessionId: string
}>()

const chatStore = useChatStore()
const sessionStore = useSessionStore()
const settingsStore = useSettingsStore()
const showExecPanel = ref(false)
const messageCount = ref(0)

let cleanupData: (() => void) | null = null
let cleanupSessionId: (() => void) | null = null
let cleanupDone: (() => void) | null = null
let cleanupError: (() => void) | null = null

function getSession() {
  return sessionStore.workspaces
    .flatMap(ws => ws.sessions)
    .find(s => s.id === props.sessionId)
}

onMounted(async () => {
  chatStore.ensureSession(props.sessionId)

  // 如果有 cliSessionId 且没有已加载的消息，从 CLI session 文件加载历史对话
  const session = getSession()
  if (session?.cliSessionId) {
    const existing = chatStore.getMessages(props.sessionId)
    if (existing.length === 0) {
      try {
        const messages = await window.electronAPI.loadCliSessionMessages({
          toolId: session.toolId,
          projectPath: session.projectPath,
          cliSessionId: session.cliSessionId,
        })
        if (messages.length > 0) {
          chatStore.loadHistoryMessages(props.sessionId, messages)
          // 历史 session 已有对话，后续消息不应是 isFirst
          messageCount.value = messages.filter(m => m.role === 'user').length
        }
      } catch (err) {
        console.warn('[SessionView] failed to load history:', err)
      }
    }
  }

  // 监听消息数据流
  cleanupData = window.electronAPI.onMessageData(props.sessionId, (data) => {
    const session = chatStore.sessionMap.get(props.sessionId)
    if (!session?.streamingMessageId) {
      chatStore.startAssistantMessage(props.sessionId)
    }
    chatStore.appendToStreaming(props.sessionId, data, getSession()?.toolId || '')
  })

  // 监听 CLI 工具的 session ID
  cleanupSessionId = window.electronAPI.onMessageSessionId(props.sessionId, (cliSessionId) => {
    console.log('[SessionView] captured cliSessionId:', cliSessionId)
    sessionStore.updateCliSessionId(props.sessionId, cliSessionId)
  })

  // 监听消息完成
  cleanupDone = window.electronAPI.onMessageDone(props.sessionId, (code) => {
    chatStore.finalizeStreaming(props.sessionId)
    if (code !== 0) {
      chatStore.addSystemMessage(props.sessionId, `[命令执行失败，退出码: ${code}]`)
    }
  })

  // 监听错误
  cleanupError = window.electronAPI.onMessageError(props.sessionId, (error) => {
    chatStore.finalizeStreaming(props.sessionId)
    chatStore.addSystemMessage(props.sessionId, `[错误: ${error}]`)
  })
})

onBeforeUnmount(() => {
  cleanupData?.()
  cleanupSessionId?.()
  cleanupDone?.()
  cleanupError?.()
  // 注意：不再自动 cancel —— 切换 session 时只是移除 listener，进程仍然在后台运行
  // 只有用户主动关闭 session 时才会调用 removeSession → messageCancel
})

/** 用户发送消息 */
async function handleSend(text: string, imagePaths: string[], model?: string, thinking?: boolean) {
  chatStore.finalizeStreaming(props.sessionId)
  chatStore.addUserMessage(props.sessionId, text)

  const session = getSession()
  if (!session) return

  messageCount.value++

  // 用最新消息内容作为 session 标题，方便了解进度
  if (text) {
    const title = text.length > 40 ? text.slice(0, 40) + '...' : text
    sessionStore.renameSession(props.sessionId, title)
  }

  await window.electronAPI.messageSend({
    sessionId: props.sessionId,
    toolId: session.toolId,
    projectDir: session.projectPath,
    message: text,
    isFirst: messageCount.value === 1,
    cliSessionId: session.cliSessionId,
    imagePaths: imagePaths.length > 0 ? imagePaths : undefined,
    model: model || settingsStore.getSelectedModel(session.toolId) || undefined,
    thinking: thinking || undefined,
  })

  chatStore.startAssistantMessage(props.sessionId)
}

function toggleExecPanel() {
  showExecPanel.value = !showExecPanel.value
}

defineExpose({ toggleExecPanel, showExecPanel })
</script>

<template>
  <div class="session-view">
    <div class="session-view__main">
      <ChatView :session-id="sessionId" :tool-id="getSession()?.toolId" @send="handleSend" />
    </div>
    <transition name="slide-panel">
      <ExecutionPanel
        v-if="showExecPanel"
        :session-id="sessionId"
        class="session-view__exec-panel"
        @close="showExecPanel = false"
      />
    </transition>
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;

.session-view {
  width: 100%;
  height: 100%;
  display: flex;
  position: relative;
  background: var(--glass-bg, var(--neu-bg));
  overflow: hidden;
}

.session-view__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.session-view__exec-panel {
  flex-shrink: 0;
}

// 执行面板滑入/滑出动画
.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: transform $duration-normal $ease-out, opacity $duration-normal $ease-out;
}

.slide-panel-enter-from,
.slide-panel-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
