<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import MessageCard from './MessageCard.vue'
import Icon from '../common/Icon.vue'
import { useChatStore } from '../../stores/chat'

const props = defineProps<{
  sessionId: string
}>()

const chatStore = useChatStore()
const scrollRef = ref<HTMLDivElement>()
const autoScroll = ref(true)

const messages = computed(() => chatStore.getMessages(props.sessionId))

// 新消息时自动滚动到底部
watch(messages, () => {
  if (autoScroll.value) {
    nextTick(() => {
      scrollToBottom()
    })
  }
}, { deep: true })

function scrollToBottom() {
  if (scrollRef.value) {
    scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  }
}

function handleScroll() {
  if (!scrollRef.value) return
  const { scrollTop, scrollHeight, clientHeight } = scrollRef.value
  // 如果用户向上滚动超过 80px，停止自动滚动
  autoScroll.value = scrollHeight - scrollTop - clientHeight < 80
}
</script>

<template>
  <div class="message-list" ref="scrollRef" @scroll="handleScroll">
    <div class="message-list__inner">
      <!-- 空状态 -->
      <div v-if="messages.length === 0" class="message-list__empty">
        <div class="message-list__empty-icon">
          <Icon name="message-circle" :size="48" />
        </div>
        <p class="message-list__empty-title">Start a conversation</p>
        <p class="message-list__empty-sub">Type a message below to begin</p>
      </div>

      <TransitionGroup name="msg-fade">
        <MessageCard
          v-for="msg in messages"
          :key="msg.id"
          :message="msg"
        />
      </TransitionGroup>

      <!-- 等待响应指示 -->
      <div v-if="chatStore.isWaiting(sessionId) && !chatStore.sessionMap.get(sessionId)?.streamingMessageId" class="message-list__waiting">
        <div class="message-list__shimmer-bar"></div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
$radius-full: 9999px;
$duration-fast: 0.15s;
$duration-slow: 0.4s;
$ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94);

.message-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 20px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--neu-scrollbar);
    border-radius: 3px;

    &:hover {
      background: var(--neu-scrollbar-hover);
    }
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }
}

.message-list__inner {
  max-width: 900px;
  margin: 0 auto;
}

// ── 空状态 ──
.message-list__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0 40px;
  animation: fadeInUp $duration-slow $ease-out;
}

.message-list__empty-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-full;
  background: var(--glass-bg-surface, var(--neu-bg));
  border: 1px solid var(--glass-border, var(--neu-border));
  color: var(--neu-text-muted);
  margin-bottom: 16px;
}

.message-list__empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--neu-text-secondary);
  margin: 0 0 6px;
}

.message-list__empty-sub {
  font-size: 13px;
  color: var(--neu-text-muted);
  margin: 0;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// ── 消息入场动画 ──
.msg-fade-enter-active {
  transition: opacity $duration-slow $ease-out,
              transform $duration-slow $ease-out;
}

.msg-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.msg-fade-leave-active {
  transition: opacity $duration-fast $ease-out;
}

.msg-fade-leave-to {
  opacity: 0;
}

// ── 等待 shimmer bar ──
.message-list__waiting {
  padding: 14px 16px;
}

.message-list__shimmer-bar {
  width: 120px;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--neu-accent) 40%,
    var(--neu-accent) 60%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: shimmerSlide 1.5s ease-in-out infinite;
}

@keyframes shimmerSlide {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
</style>
