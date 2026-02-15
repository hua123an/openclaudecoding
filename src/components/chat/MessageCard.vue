<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MessageBlock, ExecutionItem } from '../../types'
import AnsiBlock from './AnsiBlock.vue'
import MarkdownBlock from './MarkdownBlock.vue'
import Icon from '../common/Icon.vue'
import { renderMarkdown } from '../../services/markdownRenderer'
import { useSettingsStore } from '../../stores/settings'

const props = defineProps<{
  message: MessageBlock
}>()

const emit = defineEmits<{
  edit: [text: string]
  regenerate: [messageId: string]
}>()

const settingsStore = useSettingsStore()

// ── 复制状态 ──
const copied = ref(false)

// ── Thinking 折叠状态 ──
const expandedSet = ref(new Set<number>())
// ── Tool 活动日志折叠状态 ──
const toolExpandedSet = ref(new Set<string>())
// ── 是否展开所有工具（默认折叠，只显示前 COLLAPSED_COUNT 个） ──
const toolShowAll = ref(false)

const COLLAPSED_COUNT = 3

function toggleThinking(idx: number) {
  const s = expandedSet.value
  if (s.has(idx)) s.delete(idx)
  else s.add(idx)
}

function toggleTool(id: string) {
  const s = toolExpandedSet.value
  if (s.has(id)) s.delete(id)
  else s.add(id)
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

/** streaming 中但尚无实际文本内容 */
const hasTextContent = computed(() => props.message.rawContent.trim().length > 0)
const isWorking = computed(() => props.message.status === 'streaming' && !hasTextContent.value)

// ── 操作按钮 ──

async function copyMessage() {
  await navigator.clipboard.writeText(props.message.rawContent)
  copied.value = true
  setTimeout(() => { copied.value = false }, 1500)
}

function editMessage() {
  emit('edit', props.message.rawContent)
}

function regenerateMessage() {
  emit('regenerate', props.message.id)
}

// ── 活动日志辅助函数 ──

/** 可见的工具条目（折叠时只显示前 N 个） */
const visibleExecs = computed(() => {
  const all = props.message.executions
  if (toolShowAll.value || all.length <= COLLAPSED_COUNT) return all
  return all.slice(0, COLLAPSED_COUNT)
})

const hiddenCount = computed(() => {
  const all = props.message.executions
  if (toolShowAll.value || all.length <= COLLAPSED_COUNT) return 0
  return all.length - COLLAPSED_COUNT
})

/** 从 label 提取工具名 */
function toolName(label: string): string {
  const idx = label.indexOf(':')
  return idx > 0 ? label.slice(0, idx) : label
}

/** 工具操作动词（仿 Cursor 风格） */
function toolAction(exec: ExecutionItem): string {
  const name = toolName(exec.label)
  const map: Record<string, string> = {
    Read: 'Read', Write: 'Created', Edit: 'Edited',
    Bash: 'Ran', Glob: 'Searched', Grep: 'Searched',
    WebFetch: 'Fetched', WebSearch: 'Searched',
    Task: 'Delegated', TodoWrite: 'Updated',
  }
  return map[name] || name
}

/** 工具操作图标 */
function toolIcon(exec: ExecutionItem): string {
  const name = toolName(exec.label)
  const map: Record<string, string> = {
    Read: 'file-text', Write: 'file-plus', Edit: 'edit-3',
    Bash: 'terminal', Glob: 'search', Grep: 'search',
    WebFetch: 'globe', WebSearch: 'search',
    Task: 'git-branch', TodoWrite: 'check-square',
  }
  return map[name] || 'zap'
}

/** 工具操作颜色类型 */
function toolColor(exec: ExecutionItem): string {
  const name = toolName(exec.label)
  if (['Read', 'Glob', 'Grep'].includes(name)) return 'blue'
  if (['Edit', 'Write'].includes(name)) return 'green'
  if (['Bash'].includes(name)) return 'yellow'
  if (['WebFetch', 'WebSearch'].includes(name)) return 'purple'
  return 'gray'
}

/** 工具操作的文件名/描述 */
function toolDetail(exec: ExecutionItem): string {
  const idx = exec.label.indexOf(':')
  return idx > 0 ? exec.label.slice(idx + 1).trim() : ''
}

/** 工具右侧的元数据（diff 统计等） */
function toolMeta(exec: ExecutionItem): string {
  const name = toolName(exec.label)
  if (name === 'Edit' && exec.content) {
    const adds = (exec.content.match(/^\+(?!\+\+)/gm) || []).length
    const dels = (exec.content.match(/^-(?!--)/gm) || []).length
    if (adds || dels) return `+${adds} -${dels}`
  }
  return ''
}

/** 判断 content 是否有 diff */
function hasDiff(exec: ExecutionItem): boolean {
  return !!exec.content && (exec.content.includes('--- old') || exec.content.includes('+++ new'))
}
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
        <span class="message-card__time-float">{{ formatTime(message.createdAt) }}</span>
        <div class="message-card__body message-card__body--user">
          {{ message.rawContent }}
        </div>
        <div class="message-card__actions">
          <button class="message-card__action-btn" title="编辑" @click="editMessage">
            <Icon name="edit-2" :size="13" />
          </button>
          <button class="message-card__action-btn" title="复制" @click="copyMessage">
            <Icon :name="copied ? 'check' : 'copy'" :size="13" />
          </button>
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
        <span class="message-card__time-float">{{ formatTime(message.createdAt) }}</span>

        <!-- Working 状态 -->
        <div v-if="isWorking" class="message-card__working">
          <div class="working-dots">
            <span class="working-dots__dot"></span>
            <span class="working-dots__dot"></span>
            <span class="working-dots__dot"></span>
          </div>
          <span class="working-dots__text">Working</span>
        </div>

        <!-- 有 thinking 块：分段渲染 -->
        <template v-else-if="hasThinking">
          <template v-for="(seg, idx) in segments" :key="idx">
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

        <!-- 紧凑活动日志 -->
        <div v-if="message.executions.length > 0" class="activity-log">
          <div
            v-for="exec in visibleExecs"
            :key="exec.id"
            class="activity-item"
            :class="{ 'activity-item--open': toolExpandedSet.has(exec.id) }"
          >
            <div class="activity-item__row" @click="exec.content ? toggleTool(exec.id) : undefined">
              <Icon :name="toolIcon(exec)" :size="12" class="activity-item__icon" :class="`activity-item__icon--${toolColor(exec)}`" />
              <span class="activity-item__action">{{ toolAction(exec) }}</span>
              <span class="activity-item__detail">{{ toolDetail(exec) }}</span>
              <span v-if="toolMeta(exec)" class="activity-item__meta">{{ toolMeta(exec) }}</span>
              <span v-if="exec.content" class="activity-item__chevron">
                <Icon :name="toolExpandedSet.has(exec.id) ? 'chevron-down' : 'chevron-right'" :size="11" />
              </span>
            </div>
            <!-- 展开内容 -->
            <transition name="tool-expand">
              <div v-if="toolExpandedSet.has(exec.id) && exec.content" class="activity-item__body">
                <template v-if="hasDiff(exec)">
                  <div class="activity-item__diff">
                    <div
                      v-for="(line, li) in exec.content.split('\n')"
                      :key="li"
                      class="activity-item__diff-line"
                      :class="{
                        'activity-item__diff-line--path': li === 0 && !line.startsWith('-') && !line.startsWith('+'),
                        'activity-item__diff-line--old': line.startsWith('--- old'),
                        'activity-item__diff-line--new': line.startsWith('+++ new'),
                        'activity-item__diff-line--del': line.startsWith('-') && !line.startsWith('--- old') && li > 0,
                        'activity-item__diff-line--add': line.startsWith('+') && !line.startsWith('+++ new') && li > 0,
                      }"
                    >{{ line }}</div>
                  </div>
                </template>
                <template v-else>
                  <pre class="activity-item__pre">{{ exec.content }}</pre>
                </template>
              </div>
            </transition>
          </div>
          <!-- 展开更多 -->
          <button v-if="hiddenCount > 0" class="activity-log__toggle" @click="toolShowAll = !toolShowAll">
            <Icon :name="toolShowAll ? 'chevron-up' : 'chevron-down'" :size="11" />
            {{ toolShowAll ? 'Show less' : `Show ${hiddenCount} more` }}
          </button>
        </div>

        <!-- Token 用量标签 -->
        <div v-if="message.usage && message.status === 'complete'" class="message-card__usage">
          <span class="message-card__usage-item message-card__usage-item--in">
            <Icon name="arrow-down-left" :size="11" />
            {{ formatTokens(message.usage.inputTokens) }}
          </span>
          <span class="message-card__usage-item message-card__usage-item--out">
            <Icon name="arrow-up-right" :size="11" />
            {{ formatTokens(message.usage.outputTokens) }}
          </span>
        </div>

        <!-- 操作按钮行 -->
        <div v-if="message.status === 'complete'" class="message-card__actions">
          <button class="message-card__action-btn" title="复制" @click="copyMessage">
            <Icon :name="copied ? 'check' : 'copy'" :size="13" />
          </button>
          <button class="message-card__action-btn" title="重新生成" @click="regenerateMessage">
            <Icon name="refresh-cw" :size="13" />
          </button>
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

function formatTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
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

// ── 用户消息 ──
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
  position: relative;

  &:hover {
    .message-card__time-float { opacity: 1; }
  }
}

.message-card__body--user {
  color: var(--neu-text-primary);
  font-family: $font-sans;
  white-space: pre-wrap;
  word-break: break-word;
  padding: 10px 14px;
  line-height: 1.6;
  user-select: text;
}

// ── AI 消息 ──
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
  position: relative;

  &:hover {
    .message-card__time-float { opacity: 1; }
  }
}

.message-card__body--assistant {
  color: var(--neu-text-primary);
  font-family: $font-mono;
  font-size: 13px;
  line-height: 1.7;
  padding: 10px 14px;
  user-select: text;

  :deep(pre),
  :deep(code) {
    font-family: $font-mono;
  }
}

// ── 浮动时间戳 ──
.message-card__time-float {
  position: absolute;
  top: 6px;
  right: 10px;
  font-size: 10px;
  color: var(--neu-text-muted);
  opacity: 0;
  transition: opacity $duration-fast $ease-out;
  pointer-events: none;
  z-index: 1;
}

// ── 操作按钮行 ──
.message-card__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 8px 6px;
}

// ── Token 用量标签 ──
.message-card__usage {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px 4px;
}

.message-card__usage-item {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  font-family: $font-mono;
  color: var(--neu-text-muted);
  opacity: 0.7;

  &--in { color: var(--neu-accent, #5b8def); }
  &--out { color: var(--neu-success, #43a047); }
}

.message-card__action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: transparent;
  border: none;
  border-radius: $radius-sm;
  color: var(--neu-text-muted);
  cursor: pointer;
  transition: all $duration-fast $ease-out;
  padding: 0;

  &:hover {
    color: var(--neu-accent);
    background: var(--glass-bg-hover, var(--neu-bg-hover));
  }
}

// ── 系统消息 ──
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

// ── Working 状态 ──
.message-card__working {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
}

.working-dots {
  display: flex;
  align-items: center;
  gap: 4px;
}

.working-dots__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--neu-accent);
  opacity: 0.4;
  animation: dotBounce 1.4s ease-in-out infinite;

  &:nth-child(2) { animation-delay: 0.16s; }
  &:nth-child(3) { animation-delay: 0.32s; }
}

@keyframes dotBounce {
  0%, 80%, 100% {
    opacity: 0.4;
    transform: scale(1);
  }
  40% {
    opacity: 1;
    transform: scale(1.2);
  }
}

.working-dots__text {
  font-size: 12px;
  color: var(--neu-text-muted);
  font-style: italic;
}

// ══════════════════════════════════════════════════
// ── 紧凑活动日志（仿 Cursor 风格） ──
// ══════════════════════════════════════════════════

.activity-log {
  padding: 4px 10px 10px;
  display: flex;
  flex-direction: column;
}

.activity-item {
  border-radius: 4px;
  overflow: hidden;

  & + & {
    border-top: 1px solid var(--glass-border, var(--neu-border));
  }
}

.activity-item__row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  min-height: 26px;
  cursor: pointer;
  user-select: none;
  transition: background $duration-fast $ease-out;

  &:hover {
    background: var(--glass-bg-hover, var(--neu-bg-hover));
  }
}

.activity-item__icon {
  flex-shrink: 0;
  opacity: 0.85;

  &--blue { color: var(--neu-accent, #5b8def); }
  &--green { color: var(--neu-success, #43a047); }
  &--yellow { color: var(--neu-warning, #f9a825); }
  &--purple { color: #9c6ade; }
  &--gray { color: var(--neu-text-muted); }
}

.activity-item__action {
  font-size: 11px;
  font-weight: 600;
  color: var(--neu-text-secondary);
  flex-shrink: 0;
}

.activity-item__detail {
  font-size: 11px;
  color: var(--neu-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.activity-item__meta {
  font-size: 10px;
  font-family: $font-mono;
  color: var(--neu-text-muted);
  flex-shrink: 0;
  opacity: 0.7;
}

.activity-item__chevron {
  color: var(--neu-text-muted);
  display: flex;
  align-items: center;
  flex-shrink: 0;
  opacity: 0.5;
}

// ── 展开内容 ──
.activity-item__body {
  border-top: 1px solid var(--glass-border, var(--neu-border));
  max-height: 240px;
  overflow-y: auto;
  background: var(--glass-bg-surface, var(--neu-bg));

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--neu-scrollbar, var(--neu-bg-active));
    border-radius: 2px;
  }
}

.activity-item__pre {
  margin: 0;
  padding: 6px 10px;
  font-family: $font-mono;
  font-size: 10.5px;
  line-height: 1.5;
  color: var(--neu-text-muted);
  white-space: pre-wrap;
  word-break: break-all;
}

// diff 视图
.activity-item__diff {
  padding: 2px 0;
  font-family: $font-mono;
  font-size: 10.5px;
  line-height: 1.5;
}

.activity-item__diff-line {
  padding: 0 10px;
  white-space: pre-wrap;
  word-break: break-all;

  &--path {
    color: var(--neu-text-secondary);
    font-weight: 600;
    padding-bottom: 2px;
  }

  &--old {
    color: var(--neu-error, #e53935);
    font-weight: 600;
    opacity: 0.7;
  }

  &--new {
    color: var(--neu-success, #43a047);
    font-weight: 600;
    opacity: 0.7;
  }

  &--del {
    color: var(--neu-error, #e53935);
    background: rgba(229, 57, 53, 0.06);
  }

  &--add {
    color: var(--neu-success, #43a047);
    background: rgba(67, 160, 71, 0.06);
  }
}

// ── "Show N more" 按钮 ──
.activity-log__toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: center;
  padding: 4px 0;
  font-size: 11px;
  color: var(--neu-text-muted);
  background: none;
  border: none;
  cursor: pointer;
  transition: color $duration-fast $ease-out;

  &:hover {
    color: var(--neu-accent);
  }
}

// ── 展开动画 ──
.tool-expand-enter-active {
  transition: all $duration-normal $ease-out;
}

.tool-expand-leave-active {
  transition: all $duration-fast $ease-out;
}

.tool-expand-enter-from,
.tool-expand-leave-to {
  opacity: 0;
  max-height: 0;
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

// ── streaming 状态 ──
.message-card--streaming {
  .message-card__bubble--assistant {
    border-color: rgba(var(--neu-accent-rgb), 0.15);
  }
}
</style>
