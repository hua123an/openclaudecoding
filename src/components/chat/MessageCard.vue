<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MessageBlock } from '../../types'
import AnsiBlock from './AnsiBlock.vue'
import MarkdownBlock from './MarkdownBlock.vue'
import Icon from '../common/Icon.vue'
import { renderMarkdown } from '../../services/markdownRenderer'
import { useSettingsStore } from '../../stores/settings'

const props = defineProps<{
  message: MessageBlock
}>()

const settingsStore = useSettingsStore()

// ── Thinking 折叠状态 ──
const expandedSet = ref(new Set<number>())

function toggleThinking(idx: number) {
  const s = expandedSet.value
  if (s.has(idx)) s.delete(idx)
  else s.add(idx)
}

interface Segment {
  type: 'thinking' | 'text'
  content: string
  html: string
}

/** 解析 rawContent，把 <thinking> 块拆成独立片段 */
const segments = computed<Segment[]>(() => {
  if (props.message.role !== 'assistant') return []

  const raw = props.message.rawContent
  if (!raw.includes('<thinking>')) {
    return [{ type: 'text', content: raw, html: props.message.htmlContent }]
  }

  const parts: Segment[] = []
  // 同时匹配已关闭和未关闭（流式中）的 thinking 块
  const regex = /<thinking>([\s\S]*?)(?:<\/thinking>|$)/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      const text = raw.slice(lastIndex, match.index)
      if (text.trim()) parts.push({ type: 'text', content: text, html: renderMarkdown(text) })
    }
    parts.push({ type: 'thinking', content: match[1].trim(), html: '' })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < raw.length) {
    const text = raw.slice(lastIndex)
    if (text.trim()) parts.push({ type: 'text', content: text, html: renderMarkdown(text) })
  }

  return parts
})

const hasThinking = computed(() => segments.value.some(s => s.type === 'thinking'))
</script>

<template>
  <div
    class="message-card"
    :class="[
      `message-card--${message.role}`,
      { 'message-card--streaming': message.status === 'streaming' }
    ]"
  >
    <!-- 用户消息 -->
    <template v-if="message.role === 'user'">
      <div class="message-card__bubble message-card__bubble--user">
        <div class="message-card__header">
          <span class="message-card__avatar message-card__avatar--user">
            <Icon name="edit" :size="12" />
          </span>
          <span class="message-card__role">You</span>
          <span class="message-card__time">{{ formatTime(message.createdAt) }}</span>
        </div>
        <div class="message-card__body message-card__body--user">
          {{ message.rawContent }}
        </div>
      </div>
    </template>

    <!-- 系统消息 -->
    <template v-else-if="message.role === 'system'">
      <div class="message-card__system">
        <span class="message-card__system-line"></span>
        <span class="message-card__system-text">
          <AnsiBlock :html="message.htmlContent" />
        </span>
        <span class="message-card__system-line"></span>
      </div>
    </template>

    <!-- AI 助手消息 -->
    <template v-else>
      <div class="message-card__bubble message-card__bubble--assistant">
        <div class="message-card__header">
          <span class="message-card__avatar message-card__avatar--ai">
            <Icon name="zap" :size="12" />
          </span>
          <span class="message-card__role">AI</span>
          <span class="message-card__time">{{ formatTime(message.createdAt) }}</span>
        </div>

        <!-- 有 thinking 块：分段渲染 -->
        <template v-if="hasThinking">
          <template v-for="(seg, idx) in segments" :key="idx">
            <!-- Thinking 可折叠卡片 -->
            <div v-if="seg.type === 'thinking'" class="thinking-card" :class="{ 'thinking-card--open': expandedSet.has(idx) || settingsStore.thinkingMode }">
              <div class="thinking-card__header" @click="toggleThinking(idx)">
                <Icon name="loader" :size="13" class="thinking-card__icon" />
                <span class="thinking-card__label">Thinking</span>
                <span class="thinking-card__arrow">
                  <Icon :name="(expandedSet.has(idx) || settingsStore.thinkingMode) ? 'chevron-down' : 'chevron-right'" :size="12" />
                </span>
              </div>
              <transition name="thinking-expand">
                <div v-if="expandedSet.has(idx) || settingsStore.thinkingMode" class="thinking-card__body">
                  {{ seg.content }}
                </div>
              </transition>
            </div>
            <!-- 正文内容 -->
            <div v-else class="message-card__body message-card__body--assistant">
              <MarkdownBlock :html="seg.html" />
            </div>
          </template>
          <div v-if="message.status === 'streaming'" class="message-card__body message-card__body--assistant">
            <span class="message-card__cursor">&#9608;</span>
          </div>
        </template>

        <!-- 无 thinking：原始渲染 -->
        <template v-else>
          <div class="message-card__body message-card__body--assistant">
            <MarkdownBlock :html="message.htmlContent" />
            <span v-if="message.status === 'streaming'" class="message-card__cursor">&#9608;</span>
          </div>
        </template>

        <!-- streaming shimmer bar -->
        <div v-if="message.status === 'streaming'" class="message-card__shimmer-wrap">
          <div class="message-card__shimmer-bar"></div>
        </div>

        <!-- 执行操作标记 -->
        <div v-if="message.executions.length > 0" class="message-card__executions">
          <span
            v-for="exec in message.executions.slice(0, 10)"
            :key="exec.id"
            class="exec-badge"
            :class="`exec-badge--${exec.type}`"
            :title="exec.detail || exec.label"
          >
            <Icon :name="execIcon(exec.type)" :size="12" />
            <span class="exec-badge__label">{{ exec.label }}</span>
          </span>
          <span v-if="message.executions.length > 10" class="exec-badge exec-badge--more">
            +{{ message.executions.length - 10 }} more
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function execIcon(type: string): string {
  const icons: Record<string, string> = {
    file_read: 'file', file_write: 'edit', file_edit: 'edit', file_delete: 'trash',
    tool_use: 'wrench', tool_result: 'check',
    command_run: 'terminal', command_output: 'file',
  }
  return icons[type] || 'zap'
}
</script>

<style scoped lang="scss">
$radius-lg: 16px;
$radius-md: 10px;
$radius-sm: 6px;
$radius-full: 9999px;
$font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
$font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
$duration-fast: 0.15s;
$duration-normal: 0.25s;
$ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94);

.message-card {
  margin: 10px 0;
  font-size: 13px;
}

// ── 用户消息：右对齐渐变气泡 ──
.message-card--user {
  display: flex;
  justify-content: flex-end;
}

.message-card__bubble--user {
  max-width: 80%;
  margin-left: auto;
  background: var(--neu-bg-hover);
  border: 1px solid var(--glass-border, var(--neu-border));
  border-radius: $radius-lg $radius-lg $radius-sm $radius-lg;
  padding: 0;
  overflow: hidden;

  .message-card__header {
    padding: 10px 14px 0;
  }

  .message-card__role {
    color: var(--neu-text-secondary);
  }

  .message-card__time {
    color: var(--neu-text-muted);
  }

  .message-card__avatar--user {
    background: rgba(0, 0, 0, 0.06);
    color: var(--neu-text-secondary);
    box-shadow: none;
  }
}

.message-card__body--user {
  color: var(--neu-text-primary);
  font-family: $font-sans;
  white-space: pre-wrap;
  word-break: break-word;
  padding: 8px 14px 12px;
  line-height: 1.6;
}

// ── AI 消息：左对齐 ──
.message-card--assistant {
  display: flex;
  justify-content: flex-start;
}

.message-card__bubble--assistant {
  max-width: 90%;
  background: var(--glass-bg-surface, var(--neu-bg-surface));
  border: 1px solid var(--glass-border, var(--neu-border));
  border-radius: $radius-sm $radius-lg $radius-lg $radius-lg;
  overflow: hidden;

  .message-card__header {
    padding: 10px 14px 0;
  }
}

.message-card__body--assistant {
  color: var(--neu-text-primary);
  font-family: $font-mono;
  font-size: 13px;
  line-height: 1.7;
  padding: 8px 14px 12px;

  :deep(pre),
  :deep(code) {
    font-family: $font-mono;
  }
}

// ── 系统消息：居中 + divider ──
.message-card--system {
  display: flex;
  justify-content: center;
}

.message-card__system {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 6px 0;
}

.message-card__system-line {
  flex: 1;
  height: 1px;
  background: var(--neu-border-strong);
}

.message-card__system-text {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--neu-text-muted);
  max-width: 70%;
  text-align: center;
}

// ── 通用 header ──
.message-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.message-card__avatar {
  width: 20px;
  height: 20px;
  border-radius: $radius-full;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message-card__avatar--user {
  background: var(--neu-accent);
  color: white;
}

.message-card__avatar--ai {
  background: var(--neu-bg-hover);
  color: var(--neu-text-secondary);
}

.message-card__role {
  font-weight: 600;
  font-size: 12px;
  color: var(--neu-text-secondary);
}

.message-card__time {
  font-size: 11px;
  color: var(--neu-text-muted);
  margin-left: auto;
}

// ── 光标 ──
.message-card__cursor {
  display: inline-block;
  animation: blink 1s step-end infinite;
  color: var(--neu-warning);
  font-size: 12px;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

// ── Streaming shimmer bar ──
.message-card__shimmer-wrap {
  padding: 0 14px 10px;
}

.message-card__shimmer-bar {
  width: 120px;
  height: 3px;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--neu-accent) 40%,
    var(--neu-accent) 60%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

// ── 执行操作标记 pill（内凹效果）──
.message-card__executions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 14px 10px;
}

.exec-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: $radius-full;
  font-size: 11px;
  color: var(--neu-text-secondary);
  background: var(--glass-bg-surface, var(--neu-bg));
  border: 1px solid var(--glass-border, var(--neu-border));
  max-width: 220px;
  transition: background $duration-fast $ease-out;

  &:hover {
    background: var(--glass-bg-hover, var(--neu-bg-hover));
  }
}

.exec-badge__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.exec-badge--file_read,
.exec-badge--file_write,
.exec-badge--file_edit,
.exec-badge--file_delete {
  color: var(--neu-accent);
}

.exec-badge--tool_use,
.exec-badge--tool_result {
  color: var(--neu-warning);
}

.exec-badge--command_run,
.exec-badge--command_output {
  color: var(--neu-success);
}

.exec-badge--more {
  color: var(--neu-text-muted);
  font-style: italic;
}

// ── Thinking 折叠卡片 ──
.thinking-card {
  margin: 8px 14px;
  border-radius: $radius-md;
  background: var(--glass-bg-surface, var(--neu-bg));
  border: 1px solid var(--glass-border, var(--neu-border));
  overflow: hidden;
  transition: border-color $duration-fast $ease-out;
}

.thinking-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  transition: background $duration-fast $ease-out;

  &:hover {
    background: var(--glass-bg-hover, var(--neu-bg-hover));
  }
}

.thinking-card__icon {
  color: var(--neu-warning);
  flex-shrink: 0;
}

.thinking-card__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--neu-text-secondary);
  flex: 1;
}

.thinking-card__arrow {
  color: var(--neu-text-muted);
  display: flex;
  align-items: center;
  transition: transform $duration-fast $ease-out;
}

.thinking-card__body {
  padding: 0 12px 10px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--neu-text-muted);
  font-family: $font-mono;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 300px;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--neu-scrollbar, var(--neu-bg-active));
    border-radius: 2px;
  }
}

// Thinking 展开动画
.thinking-expand-enter-active {
  transition: all $duration-normal $ease-out;
}

.thinking-expand-leave-active {
  transition: all $duration-fast $ease-out;
}

.thinking-expand-enter-from,
.thinking-expand-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
}

// ── streaming 状态下整体样式 ──
.message-card--streaming {
  .message-card__bubble--assistant {
    border-color: rgba(var(--neu-accent-rgb), 0.15);
  }
}
</style>
