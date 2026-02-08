<script setup lang="ts">
import MessageList from './MessageList.vue'
import ChatInput from './ChatInput.vue'
import { ref } from 'vue'

defineProps<{
  sessionId: string
  toolId?: string
}>()

const emit = defineEmits<{
  send: [text: string, imagePaths: string[], model?: string, thinking?: boolean]
}>()

const chatInputRef = ref<InstanceType<typeof ChatInput>>()

function handleSend(text: string, imagePaths: string[], model?: string, thinking?: boolean) {
  emit('send', text, imagePaths, model, thinking)
}
</script>

<template>
  <div class="chat-view">
    <MessageList :session-id="sessionId" />
    <ChatInput ref="chatInputRef" :tool-id="toolId" @send="handleSend" />
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
