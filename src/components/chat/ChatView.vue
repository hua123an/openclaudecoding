<script setup lang="ts">
import MessageList from './MessageList.vue'
import ChatInput from './ChatInput.vue'
import { ref, nextTick } from 'vue'

defineProps<{
  sessionId: string
  toolId?: string
  isStreaming?: boolean
}>()

const emit = defineEmits<{
  send: [text: string, imagePaths: string[], model?: string, thinking?: boolean]
  cancel: []
  regenerate: [messageId: string]
}>()

const chatInputRef = ref<InstanceType<typeof ChatInput>>()

function handleSend(text: string, imagePaths: string[], model?: string, thinking?: boolean) {
  emit('send', text, imagePaths, model, thinking)
}

function handleEdit(text: string) {
  chatInputRef.value?.setInputText(text)
}

function handleRegenerate(messageId: string) {
  emit('regenerate', messageId)
}

function focusInput() {
  nextTick(() => {
    chatInputRef.value?.focus()
  })
}

defineExpose({ focusInput })
</script>

<template>
  <div class="chat-view">
    <MessageList :session-id="sessionId" @edit="handleEdit" @regenerate="handleRegenerate" />
    <ChatInput ref="chatInputRef" :tool-id="toolId" :is-streaming="isStreaming" @send="handleSend" @cancel="emit('cancel')" />
  </div>
</template>

<style scoped lang="scss">
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-height: 0;
  overflow: hidden;
}
</style>
