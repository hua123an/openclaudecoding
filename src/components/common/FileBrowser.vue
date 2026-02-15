<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue'
import Icon from './Icon.vue'

// 弹窗根元素引用（用于自动聚焦）
const fbRef = ref<HTMLElement>()
// 文件列表容器引用（用于滚动到焦点条目）
const listRef = ref<HTMLElement>()

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  select: [path: string]
  cancel: []
}>()

interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  mtime: number
}

const currentDir = ref('')
const entries = ref<FileEntry[]>([])
const selectedPath = ref<string | null>(null)
const loading = ref(false)
const error = ref('')
const editingPath = ref(false)
const pathInput = ref('')
const pathInputRef = ref<HTMLInputElement>()
const homeDir = ref('')
const focusedIndex = ref(-1)

// 所有目录条目在 entries 中的索引列表
const dirIndices = computed(() => {
  const indices: number[] = []
  entries.value.forEach((e, i) => {
    if (e.isDirectory) indices.push(i)
  })
  return indices
})

// 快捷目录
const shortcuts = computed(() => {
  if (!homeDir.value) return []
  return [
    { name: '主目录', path: homeDir.value, icon: 'home' },
    { name: '桌面', path: homeDir.value + '/Desktop', icon: 'monitor' },
    { name: '文档', path: homeDir.value + '/Documents', icon: 'file' },
    { name: '下载', path: homeDir.value + '/Downloads', icon: 'download' },
  ]
})

// 面包屑
const breadcrumbs = computed(() => {
  if (!currentDir.value) return []
  const parts = currentDir.value.split('/').filter(Boolean)
  return parts.map((name, i) => ({
    name: i === 0 ? '/' + name : name,
    path: '/' + parts.slice(0, i + 1).join('/'),
  }))
})

async function loadDir(dirPath: string) {
  loading.value = true
  error.value = ''
  selectedPath.value = null
  focusedIndex.value = -1
  try {
    const result = await window.electronAPI.fsReadDir(dirPath)
    if ('error' in result) {
      error.value = (result as any).error
      entries.value = []
    } else {
      entries.value = result as FileEntry[]
      currentDir.value = dirPath
    }
  } catch (err: any) {
    error.value = err.message || '无法读取目录'
    entries.value = []
  } finally {
    loading.value = false
  }
}

function goUp() {
  const parent = currentDir.value.replace(/\/[^/]+\/?$/, '') || '/'
  loadDir(parent)
}

function handleEntryClick(entry: FileEntry) {
  if (entry.isDirectory) {
    selectedPath.value = entry.path
    // 同步 focusedIndex，让后续键盘导航从点击位置继续
    const idx = entries.value.findIndex(e => e.path === entry.path)
    if (idx >= 0) focusedIndex.value = idx
  }
}

function handleEntryDblClick(entry: FileEntry) {
  if (entry.isDirectory) {
    loadDir(entry.path)
  }
}

function handleSelect() {
  // 如果没有选中子文件夹，就选择当前目录
  const dir = selectedPath.value || currentDir.value
  if (dir) emit('select', dir)
}

function handleCancel() {
  emit('cancel')
}

function startEditPath() {
  editingPath.value = true
  pathInput.value = currentDir.value
  nextTick(() => {
    pathInputRef.value?.focus()
    pathInputRef.value?.select()
  })
}

function confirmPath() {
  editingPath.value = false
  const p = pathInput.value.trim()
  if (p) loadDir(p)
}

function cancelEditPath() {
  editingPath.value = false
}

function goToShortcut(path: string) {
  loadDir(path)
}

// ── 键盘导航 ──

function scrollToFocused() {
  nextTick(() => {
    if (!listRef.value || focusedIndex.value < 0) return
    const el = listRef.value.querySelector(`[data-index="${focusedIndex.value}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  })
}

function handleKeydown(e: KeyboardEvent) {
  // 编辑路径时不拦截键盘事件
  if (editingPath.value) return

  const dirs = dirIndices.value
  if (dirs.length === 0 && !['Escape'].includes(e.key)) return

  switch (e.key) {
    case 'ArrowDown': {
      e.preventDefault()
      if (dirs.length === 0) return
      if (focusedIndex.value < 0) {
        // 没有焦点，聚焦第一个目录
        focusedIndex.value = dirs[0]
      } else {
        const curPos = dirs.indexOf(focusedIndex.value)
        if (curPos < dirs.length - 1) {
          focusedIndex.value = dirs[curPos + 1]
        }
      }
      selectedPath.value = entries.value[focusedIndex.value].path
      scrollToFocused()
      break
    }
    case 'ArrowUp': {
      e.preventDefault()
      if (dirs.length === 0) return
      if (focusedIndex.value < 0) {
        // 没有焦点，聚焦最后一个目录
        focusedIndex.value = dirs[dirs.length - 1]
      } else {
        const curPos = dirs.indexOf(focusedIndex.value)
        if (curPos > 0) {
          focusedIndex.value = dirs[curPos - 1]
        }
      }
      selectedPath.value = entries.value[focusedIndex.value].path
      scrollToFocused()
      break
    }
    case 'Enter': {
      e.preventDefault()
      if (focusedIndex.value >= 0 && entries.value[focusedIndex.value]?.isDirectory) {
        loadDir(entries.value[focusedIndex.value].path)
      } else {
        handleSelect()
      }
      break
    }
    case 'Escape': {
      e.preventDefault()
      handleCancel()
      break
    }
    case 'Backspace': {
      e.preventDefault()
      goUp()
      break
    }
  }
}

function formatTime(mtime: number): string {
  return new Date(mtime).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// visible 变为 true 时加载主目录并自动聚焦
watch(() => props.visible, async (v) => {
  if (v) {
    if (!homeDir.value) {
      homeDir.value = await window.electronAPI.fsHomeDir()
    }
    if (!currentDir.value) {
      currentDir.value = homeDir.value
    }
    loadDir(currentDir.value)
    // 等待 DOM 渲染后自动聚焦弹窗
    nextTick(() => {
      fbRef.value?.focus()
    })
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fb-fade">
      <div v-if="visible" class="fb-overlay" @click.self="handleCancel">
        <Transition name="fb-scale" appear>
          <div class="fb" ref="fbRef" tabindex="0" @keydown="handleKeydown">
            <!-- 导航栏 -->
            <div class="fb__nav">
              <button class="fb__nav-btn" @click="goUp" title="返回上级">
                <Icon name="chevron-left" :size="16" />
              </button>
              <div class="fb__path" @click="startEditPath" v-if="!editingPath">
                <template v-for="(bc, i) in breadcrumbs" :key="bc.path">
                  <span
                    class="fb__crumb"
                    :class="{ 'fb__crumb--last': i === breadcrumbs.length - 1 }"
                    @click.stop="loadDir(bc.path)"
                  >{{ bc.name }}</span>
                  <span v-if="i < breadcrumbs.length - 1" class="fb__crumb-sep">/</span>
                </template>
              </div>
              <input
                v-else
                ref="pathInputRef"
                v-model="pathInput"
                class="fb__path-input"
                @keydown.enter="confirmPath"
                @keydown.escape="cancelEditPath"
                @blur="confirmPath"
              />
            </div>

            <!-- 快捷入口 -->
            <div class="fb__shortcuts">
              <button
                v-for="sc in shortcuts"
                :key="sc.path"
                class="fb__shortcut"
                :class="{ 'fb__shortcut--active': currentDir === sc.path }"
                @click="goToShortcut(sc.path)"
              >
                <Icon :name="sc.icon" :size="13" />
                <span>{{ sc.name }}</span>
              </button>
            </div>

            <!-- 文件列表 -->
            <div class="fb__list" ref="listRef">
              <div v-if="loading" class="fb__loading">读取中...</div>
              <div v-else-if="error" class="fb__error">{{ error }}</div>
              <div v-else-if="entries.length === 0" class="fb__empty">此目录为空</div>
              <div
                v-for="(entry, i) in entries"
                :key="entry.path"
                :data-index="i"
                class="fb__entry"
                :class="{
                  'fb__entry--dir': entry.isDirectory,
                  'fb__entry--selected': selectedPath === entry.path,
                  'fb__entry--focused': focusedIndex === i,
                }"
                @click="handleEntryClick(entry)"
                @dblclick="handleEntryDblClick(entry)"
              >
                <Icon :name="entry.isDirectory ? 'folder' : 'file'" :size="15" class="fb__entry-icon" />
                <span class="fb__entry-name">{{ entry.name }}</span>
                <span class="fb__entry-time">{{ formatTime(entry.mtime) }}</span>
              </div>
            </div>

            <!-- 底部栏 -->
            <div class="fb__footer">
              <span class="fb__selected-path">{{ selectedPath || currentDir }}</span>
              <div class="fb__footer-actions">
                <button class="fb__btn fb__btn--cancel" @click="handleCancel">取消</button>
                <button class="fb__btn fb__btn--confirm" @click="handleSelect">选择</button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;

.fb-overlay {
  position: fixed;
  inset: 0;
  background: var(--neu-overlay);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.fb {
  width: 520px;
  max-height: 70vh;
  background: var(--glass-bg-alt);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border-strong);
  border-radius: $radius-xl;
  overflow: hidden;
  box-shadow: var(--glass-shadow), 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  outline: none;
}

// ── 导航栏 ──
.fb__nav {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--glass-border);
  flex-shrink: 0;
}

.fb__nav-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--glass-border);
  color: var(--neu-text-muted);
  cursor: pointer;
  border-radius: $radius-sm;
  flex-shrink: 0;
  padding: 0;
  transition: all $duration-fast $ease-out;

  &:hover {
    color: var(--neu-text-primary);
    background: var(--glass-bg-hover);
  }
}

.fb__path {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  color: var(--neu-text-muted);
  overflow: hidden;
  cursor: text;
  padding: 4px 8px;
  border-radius: $radius-sm;
  transition: background $duration-fast $ease-out;

  &:hover {
    background: var(--glass-bg-hover);
  }
}

.fb__crumb {
  white-space: nowrap;
  cursor: pointer;
  transition: color $duration-fast $ease-out;

  &:hover {
    color: var(--neu-accent);
  }

  &--last {
    color: var(--neu-text-primary);
    font-weight: 500;
  }
}

.fb__crumb-sep {
  color: var(--neu-text-muted);
  opacity: 0.4;
  margin: 0 1px;
}

.fb__path-input {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--neu-text-primary);
  background: var(--glass-bg-surface);
  border: 1px solid var(--neu-accent);
  border-radius: $radius-sm;
  padding: 4px 8px;
  outline: none;
  font-family: $font-mono;
}

// ── 快捷入口 ──
.fb__shortcuts {
  display: flex;
  gap: 4px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--glass-border);
  flex-shrink: 0;
}

.fb__shortcut {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  font-size: 11px;
  color: var(--neu-text-muted);
  background: transparent;
  border: 1px solid var(--glass-border);
  border-radius: $radius-full;
  cursor: pointer;
  transition: all $duration-fast $ease-out;
  white-space: nowrap;

  &:hover {
    color: var(--neu-text-primary);
    background: var(--glass-bg-hover);
    border-color: var(--glass-border-strong);
  }

  &--active {
    color: var(--neu-accent);
    background: rgba(var(--neu-accent-rgb), 0.08);
    border-color: rgba(var(--neu-accent-rgb), 0.2);
  }
}

// ── 文件列表 ──
.fb__list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 8px;

  &::-webkit-scrollbar {
    width: 5px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--neu-scrollbar);
    border-radius: 3px;
  }
}

.fb__loading,
.fb__error,
.fb__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 16px;
  font-size: 13px;
  color: var(--neu-text-muted);
}

.fb__error {
  color: var(--neu-error);
}

.fb__entry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all $duration-fast $ease-out;
  user-select: none;

  &:hover {
    background: var(--glass-bg-hover);
  }

  &--selected {
    background: rgba(var(--neu-accent-rgb), 0.08);
    border: 1px solid rgba(var(--neu-accent-rgb), 0.15);

    .fb__entry-name {
      color: var(--neu-text-primary);
      font-weight: 500;
    }
  }

  &--focused {
    background: rgba(var(--neu-accent-rgb), 0.06);
    outline: 1px solid rgba(var(--neu-accent-rgb), 0.25);
    outline-offset: -1px;

    .fb__entry-name {
      color: var(--neu-text-primary);
    }
  }

  &--focused#{&}--selected {
    background: rgba(var(--neu-accent-rgb), 0.12);
    outline: 1px solid rgba(var(--neu-accent-rgb), 0.3);
    outline-offset: -1px;
    border: 1px solid rgba(var(--neu-accent-rgb), 0.2);
  }

  &--dir .fb__entry-icon {
    color: var(--neu-accent);
  }

  &:not(&--dir) {
    opacity: 0.5;
    cursor: default;
  }
}

.fb__entry-icon {
  flex-shrink: 0;
  color: var(--neu-text-muted);
}

.fb__entry-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--neu-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fb__entry-time {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--neu-text-muted);
  opacity: 0.6;
}

// ── 底部栏 ──
.fb__footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-top: 1px solid var(--glass-border);
  flex-shrink: 0;
}

.fb__selected-path {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  font-family: $font-mono;
  color: var(--neu-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fb__footer-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.fb__btn {
  padding: 6px 16px;
  font-size: 12px;
  font-weight: 500;
  border-radius: $radius-sm;
  cursor: pointer;
  transition: all $duration-fast $ease-out;

  &--cancel {
    background: transparent;
    border: 1px solid var(--glass-border);
    color: var(--neu-text-secondary);

    &:hover {
      background: var(--glass-bg-hover);
    }
  }

  &--confirm {
    background: var(--neu-accent);
    border: none;
    color: #fff;

    &:hover {
      opacity: 0.85;
    }

    &:active {
      transform: scale(0.97);
    }
  }
}

// ── 动画 ──
.fb-fade-enter-active,
.fb-fade-leave-active {
  transition: opacity $duration-normal $ease-out;
}

.fb-fade-enter-from,
.fb-fade-leave-to {
  opacity: 0;
}

.fb-scale-enter-active {
  transition: all $duration-normal $ease-spring;
}

.fb-scale-leave-active {
  transition: all $duration-fast $ease-out;
}

.fb-scale-enter-from {
  opacity: 0;
  transform: scale(0.92);
}

.fb-scale-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
