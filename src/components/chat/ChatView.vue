<script setup lang="ts">
import MessageList from './MessageList.vue'
import ChatInput from './ChatInput.vue'
import { ref } from 'vue'

defineProps<{
  sessionId: string
  toolId?: string
  isStreaming?: boolean
}>()

const emit = defineEmits<{
  send: [text: string, imagePaths: string[], model?: string, thinking?: boolean]
  cancel: []
}>()

const chatInputRef = ref<InstanceType<typeof ChatInput>>()

function handleSend(text: string, imagePaths: string[], model?: string, thinking?: boolean) {
  emit('send', text, imagePaths, model, thinking)
}
</script>

<template>
  <div class="chat-view">
    <MessageList :session-id="sessionId" />
    <ChatInput ref="chatInputRef" :tool-id="toolId" :is-streaming="isStreaming" @send="handleSend" @cancel="emit('cancel')" />
  </div>
</template>

<style scoped lang="scss">
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}
</style>
