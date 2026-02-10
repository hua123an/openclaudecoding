<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import MessageCard from './MessageCard.vue'
import Icon from '../common/Icon.vue'
import { useChatStore } from '../../stores/chat'

const props = defineProps<{
  sessionId: string
}>()

const emit = defineEmits<{
  edit: [text: string]
  regenerate: [messageId: string]
}>()

const chatStore = useChatStore()
const scrollRef = ref<HTMLDivElement>()
const autoScroll = ref(true)

/** 是否不在顶部（显示回到顶部按钮） */
const showScrollTop = ref(false)
/** 是否不在底部（显示回到底部按钮） */
const showScrollBottom = ref(false)

const messages = computed(() => chatStore.getMessages(props.sessionId))

// 新消息时自动滚动到底部
watch(messages, () => {
  if (autoScroll.value) {
    nextTick(() => {
      scrollToBottom()
    })
  }
}, { deep: true })

function scrollToTop() {
  if (scrollRef.value) {
    scrollRef.value.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

function scrollToBottom() {
  if (scrollRef.value) {
    scrollRef.value.scrollTo({ top: scrollRef.value.scrollHeight, behavior: 'smooth' })
  }
}

function handleScroll() {
  if (!scrollRef.value) return
  const { scrollTop, scrollHeight, clientHeight } = scrollRef.value
  const distanceToBottom = scrollHeight - scrollTop - clientHeight
  // 如果用户向上滚动超过 80px，停止自动滚动
  autoScroll.value = distanceToBottom < 80
  // 控制按钮显示
  showScrollTop.value = scrollTop > 200
  showScrollBottom.value = distanceToBottom > 200
}
</script>

<template>
  <div class="message-list-wrapper">
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
            @edit="(text: string) => emit('edit', text)"
            @regenerate="(id: string) => emit('regenerate', id)"
          />
        </TransitionGroup>
      </div>
    </div>

    <!-- 悬浮导航按钮 -->
    <transition name="fab-fade">
      <div v-if="showScrollTop || showScrollBottom" class="message-list__fab-group">
        <button
          v-if="showScrollTop"
          class="message-list__fab"
          title="回到顶部"
          @click="scrollToTop"
        >
          <Icon name="chevron-up" :size="18" />
        </button>
        <button
          v-if="showScrollBottom"
          class="message-list__fab"
          title="回到底部"
          @click="scrollToBottom"
        >
          <Icon name="chevron-down" :size="18" />
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped lang="scss">
$radius-full: 9999px;
$duration-fast: 0.15s;
$duration-slow: 0.4s;
$ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94);

.message-list-wrapper {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  flex-direction: column;
}

.message-list {
  flex: 1;
  min-height: 0;
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

// ── 悬浮按钮组 ──
.message-list__fab-group {
  position: absolute;
  right: 24px;
  bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 10;
}

.message-list__fab {
  width: 36px;
  height: 36px;
  border-radius: $radius-full;
  border: 1px solid var(--glass-border, var(--neu-border));
  background: var(--glass-bg-surface, var(--neu-bg));
  color: var(--neu-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s $ease-out;

  &:hover {
    background: var(--glass-bg-hover, var(--neu-bg-hover, var(--neu-bg)));
    color: var(--neu-text-primary);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
}

// 按钮淡入淡出
.fab-fade-enter-active,
.fab-fade-leave-active {
  transition: opacity 0.2s $ease-out, transform 0.2s $ease-out;
}

.fab-fade-enter-from,
.fab-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
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
</style>
