<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import Icon from '../common/Icon.vue'
import { useSettingsStore } from '../../stores/settings'
import type { SkillItem } from '../../types'

const props = defineProps<{
  toolId?: string
  isStreaming?: boolean
}>()

const emit = defineEmits<{
  send: [text: string, imagePaths: string[], model?: string, thinking?: boolean]
  cancel: []
}>()

const settingsStore = useSettingsStore()

const inputText = ref('')
const inputRef = ref<HTMLTextAreaElement>()
const images = ref<string[]>([])

// ── 模型选择器 ──
const showModelDropdown = ref(false)
const modelDropdownRef = ref<HTMLDivElement>()

const toolModels = computed(() => {
  if (!props.toolId) return []
  return settingsStore.getModelsForTool(props.toolId)
})

const hasModels = computed(() => toolModels.value.length > 0)

const currentModelLabel = computed(() => {
  if (!props.toolId) return ''
  const modelId = settingsStore.getSelectedModel(props.toolId)
  const model = toolModels.value.find(m => m.id === modelId)
  return model?.label || modelId || ''
})

function toggleModelDropdown() {
  showModelDropdown.value = !showModelDropdown.value
}

function selectModel(modelId: string) {
  if (props.toolId) {
    settingsStore.setModelForTool(props.toolId, modelId)
  }
  showModelDropdown.value = false
}

function handleClickOutside(e: MouseEvent) {
  if (modelDropdownRef.value && !modelDropdownRef.value.contains(e.target as Node)) {
    showModelDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

// ── Skills (Slash Commands) ──
const skills = ref<SkillItem[]>([])
const showSkills = ref(false)
const skillFilter = ref('')
const selectedSkillIdx = ref(0)

const filteredSkills = computed(() => {
  if (!skillFilter.value) return skills.value
  const q = skillFilter.value.toLowerCase()
  return skills.value.filter(s =>
    s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
  )
})

onMounted(async () => {
  try {
    skills.value = await window.electronAPI.listSkills()
  } catch {}
})

watch(inputText, (val) => {
  // 检测 / 命令输入
  if (val.startsWith('/') && !val.includes('\n')) {
    showSkills.value = true
    skillFilter.value = val.slice(1)
    selectedSkillIdx.value = 0
  } else {
    showSkills.value = false
  }
})

function selectSkill(skill: SkillItem) {
  inputText.value = `/${skill.name} `
  showSkills.value = false
  inputRef.value?.focus()
}

const canSend = computed(() => inputText.value.trim().length > 0 || images.value.length > 0)

function handleKeydown(e: KeyboardEvent) {
  // Slash command 键盘导航
  if (showSkills.value && filteredSkills.value.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectedSkillIdx.value = Math.min(selectedSkillIdx.value + 1, filteredSkills.value.length - 1)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectedSkillIdx.value = Math.max(selectedSkillIdx.value - 1, 0)
      return
    }
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      selectSkill(filteredSkills.value[selectedSkillIdx.value])
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      showSkills.value = false
      return
    }
  }

  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    handleSend()
  }
}

function handleSend() {
  const text = inputText.value.trim()
  if (!text && images.value.length === 0) return
  const model = props.toolId ? settingsStore.getSelectedModel(props.toolId) || undefined : undefined
  const thinking = settingsStore.thinkingMode || undefined
  emit('send', text, [...images.value], model, thinking)
  inputText.value = ''
  images.value = []
  // 重置 textarea 高度
  if (inputRef.value) {
    inputRef.value.style.height = 'auto'
  }
}

async function handleAttach() {
  const paths = await window.electronAPI.openImageDialog()
  if (paths && paths.length > 0) {
    images.value.push(...paths)
  }
}

function removeImage(index: number) {
  images.value.splice(index, 1)
}

/** 从文件路径提取文件名 */
function fileName(p: string) {
  return p.split('/').pop() || p
}

function handleInput() {
  // 自动调整高度
  if (inputRef.value) {
    inputRef.value.style.height = 'auto'
    inputRef.value.style.height = Math.min(inputRef.value.scrollHeight, 160) + 'px'
  }
}

/** 粘贴图片：从剪贴板读取图片 → 保存为临时文件 → 加入预览 */
async function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (!item.type.startsWith('image/')) continue

    e.preventDefault()
    const blob = item.getAsFile()
    if (!blob) continue

    // Blob → base64
    const buffer = await blob.arrayBuffer()
    const base64 = btoa(
      new Uint8Array(buffer).reduce((s, b) => s + String.fromCharCode(b), '')
    )

    // 发送到主进程保存为临时文件
    const filePath = await window.electronAPI.saveClipboardImage(base64, item.type)
    if (filePath) {
      images.value.push(filePath)
    }
  }
}

function focus() {
  inputRef.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="chat-input">
    <!-- Slash Command 弹窗 -->
    <transition name="skill-popup-fade">
      <div v-if="showSkills && filteredSkills.length > 0" class="skill-popup">
        <div class="skill-popup__header">
          <Icon name="zap" :size="12" />
          <span>Skills</span>
        </div>
        <div class="skill-popup__list">
          <button
            v-for="(skill, idx) in filteredSkills.slice(0, 10)"
            :key="skill.id"
            class="skill-popup__item"
            :class="{ 'skill-popup__item--active': idx === selectedSkillIdx }"
            @click="selectSkill(skill)"
            @mouseenter="selectedSkillIdx = idx"
          >
            <span class="skill-popup__name">/{{ skill.name }}</span>
            <span class="skill-popup__desc">{{ skill.description }}</span>
            <span class="skill-popup__plugin">{{ skill.pluginName }}</span>
          </button>
        </div>
      </div>
    </transition>

    <!-- 图片预览条 -->
    <div v-if="images.length > 0" class="chat-input__images">
      <div v-for="(img, idx) in images" :key="img" class="chat-input__image-item">
        <img :src="'local-file://' + img" class="chat-input__image-thumb" :alt="fileName(img)" />
        <button class="chat-input__image-remove" @click="removeImage(idx)" title="移除图片">
          <Icon name="x" :size="10" />
        </button>
        <span class="chat-input__image-name">{{ fileName(img) }}</span>
      </div>
    </div>

    <!-- 工具栏行 -->
    <div class="chat-input__toolbar">
      <div class="chat-input__toolbar-left">
        <button class="chat-input__toolbar-btn" title="添加图片" @click="handleAttach">
          <Icon name="image" :size="15" />
        </button>
      </div>
      <div class="chat-input__toolbar-right">
        <!-- 模型选择器 -->
        <div v-if="hasModels" ref="modelDropdownRef" class="model-picker">
          <button class="model-picker__trigger" @click.stop="toggleModelDropdown">
            <Icon name="cpu" :size="12" />
            <span>{{ currentModelLabel }}</span>
            <Icon :name="showModelDropdown ? 'chevron-up' : 'chevron-down'" :size="10" />
          </button>
          <transition name="dropdown-fade">
            <div v-if="showModelDropdown" class="model-picker__dropdown">
              <button
                v-for="model in toolModels"
                :key="model.id"
                class="model-picker__option"
                :class="{ 'model-picker__option--active': settingsStore.getSelectedModel(toolId || '') === model.id }"
                @click="selectModel(model.id)"
              >
                <span class="model-picker__radio">
                  <span v-if="settingsStore.getSelectedModel(toolId || '') === model.id" class="model-picker__radio-dot"></span>
                </span>
                <span class="model-picker__option-info">
                  <span class="model-picker__option-label">{{ model.label }}</span>
                  <span v-if="model.description" class="model-picker__option-desc">{{ model.description }}</span>
                </span>
              </button>
            </div>
          </transition>
        </div>
        <!-- 思考模式开关 -->
        <button
          class="thinking-toggle"
          :class="{ 'thinking-toggle--active': settingsStore.thinkingMode }"
          @click="settingsStore.toggleThinking()"
          title="Thinking Mode"
        >
          <Icon name="lightbulb" :size="13" />
          <span>Thinking</span>
        </button>
      </div>
    </div>

    <!-- textarea + 发送按钮 -->
    <div class="chat-input__wrapper">
      <textarea
        ref="inputRef"
        v-model="inputText"
        class="chat-input__textarea"
        placeholder="Ask anything... (Ctrl+Enter to send)"
        rows="1"
        @keydown="handleKeydown"
        @input="handleInput"
        @paste="handlePaste"
      ></textarea>
      <button
        v-if="isStreaming"
        class="chat-input__stop"
        @click="emit('cancel')"
        title="停止生成"
      >
        <span class="chat-input__stop-spinner"></span>
        <span class="chat-input__stop-icon"></span>
      </button>
      <button
        v-else
        class="chat-input__send"
        :disabled="!canSend"
        @click="handleSend"
      >
        <Icon name="send" :size="16" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
$radius-lg: 16px;
$radius-md: 10px;
$radius-sm: 6px;
$radius-full: 9999px;
$font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
$duration-fast: 0.15s;
$duration-normal: 0.25s;
$ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94);
$ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);

.chat-input {
  flex-shrink: 0;
  padding: 10px 16px 14px;
  position: relative;
}

// ── 工具栏行 ──
.chat-input__toolbar {
  max-width: 900px;
  margin: 0 auto 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}

.chat-input__toolbar-left,
.chat-input__toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.chat-input__toolbar-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: 1px solid var(--glass-border, var(--neu-border));
  border-radius: $radius-md;
  color: var(--neu-text-muted);
  cursor: pointer;
  transition: all $duration-fast $ease-out;

  &:hover {
    color: var(--neu-text-secondary);
    background: var(--glass-bg-hover, var(--neu-bg-hover));
    border-color: var(--glass-border-strong, var(--neu-border-strong));
  }
}

// ── 模型选择器 ──
.model-picker {
  position: relative;
}

.model-picker__trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: $radius-full;
  border: 1px solid var(--glass-border, var(--neu-border));
  background: var(--glass-bg-surface, var(--neu-bg-surface));
  color: var(--neu-text-secondary);
  cursor: pointer;
  transition: all $duration-fast $ease-out;

  &:hover {
    background: var(--glass-bg-hover, var(--neu-bg-hover));
    color: var(--neu-accent);
    border-color: var(--glass-border-strong, var(--neu-border-strong));
  }
}

.model-picker__dropdown {
  position: absolute;
  bottom: calc(100% + 6px);
  right: 0;
  min-width: 200px;
  background: var(--glass-bg-surface, var(--neu-bg-surface));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border-strong, var(--neu-border-strong));
  border-radius: $radius-md;
  box-shadow: var(--glass-shadow, 0 4px 24px rgba(0, 0, 0, 0.2));
  padding: 4px;
  z-index: 100;
}

.model-picker__option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: $radius-sm;
  background: transparent;
  color: var(--neu-text-secondary);
  cursor: pointer;
  text-align: left;
  transition: background $duration-fast $ease-out;

  &:hover {
    background: var(--glass-bg-hover, var(--neu-bg-hover));
  }

  &--active {
    background: var(--glass-bg-active, var(--neu-bg-active));
    color: var(--neu-accent);
  }
}

.model-picker__radio {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--neu-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  .model-picker__option--active & {
    border-color: var(--neu-accent);
  }
}

.model-picker__radio-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--neu-accent);
}

.model-picker__option-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.model-picker__option-label {
  font-size: 12px;
  font-weight: 500;
}

.model-picker__option-desc {
  font-size: 10px;
  color: var(--neu-text-muted);
}

// ── Thinking 开关 ──
.thinking-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: $radius-full;
  border: 1px solid var(--glass-border, var(--neu-border));
  background: transparent;
  color: var(--neu-text-muted);
  cursor: pointer;
  transition: all $duration-fast $ease-out;

  &:hover {
    color: var(--neu-text-secondary);
    background: var(--glass-bg-hover, var(--neu-bg-hover));
  }

  &--active {
    color: var(--neu-warning);
    border-color: rgba(232, 168, 56, 0.3);
    background: rgba(232, 168, 56, 0.08);

    &:hover {
      background: rgba(232, 168, 56, 0.12);
    }
  }
}

// ── Slash Command 弹窗 ──
.skill-popup {
  position: absolute;
  bottom: 100%;
  left: 16px;
  right: 16px;
  max-width: 900px;
  margin: 0 auto 8px;
  background: var(--glass-bg-surface, var(--neu-bg-surface));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border-strong, var(--neu-border-strong));
  border-radius: $radius-lg;
  box-shadow: var(--glass-shadow, 0 4px 24px rgba(0, 0, 0, 0.2));
  overflow: hidden;
  z-index: 50;
  max-height: 320px;
  overflow-y: auto;
}

.skill-popup__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--neu-text-muted);
  border-bottom: 1px solid var(--glass-border, var(--neu-border));
}

.skill-popup__list {
  padding: 4px;
}

.skill-popup__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  color: var(--neu-text-primary);
  cursor: pointer;
  text-align: left;
  transition: background $duration-fast $ease-out;

  &:hover,
  &--active {
    background: var(--glass-bg-hover, var(--neu-bg-hover));
  }
}

.skill-popup__name {
  font-size: 13px;
  font-weight: 600;
  font-family: $font-sans;
  color: var(--neu-accent);
  flex-shrink: 0;
  min-width: 100px;
}

.skill-popup__desc {
  font-size: 12px;
  color: var(--neu-text-secondary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-popup__plugin {
  font-size: 10px;
  color: var(--neu-text-muted);
  padding: 1px 6px;
  border-radius: $radius-full;
  background: var(--glass-bg-surface, var(--neu-bg));
  border: 1px solid var(--glass-border, var(--neu-border));
  flex-shrink: 0;
}

// 弹窗动画
.skill-popup-fade-enter-active {
  transition: all $duration-fast $ease-out;
}

.skill-popup-fade-leave-active {
  transition: all 0.1s $ease-out;
}

.skill-popup-fade-enter-from,
.skill-popup-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

// ---- 图片预览条 ----
.chat-input__images {
  max-width: 900px;
  margin: 0 auto 8px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 10px;
  border-radius: $radius-lg;
  border: 1px solid var(--glass-border, var(--neu-border));
  background: var(--glass-bg-surface, var(--neu-bg));
}

.chat-input__image-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 72px;
}

.chat-input__image-thumb {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: $radius-md;
  border: 1px solid var(--glass-border, var(--neu-border));
}

.chat-input__image-remove {
  position: absolute;
  top: -4px;
  right: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--neu-error, #e53935);
  border: 2px solid var(--neu-bg);
  border-radius: $radius-full;
  color: white;
  cursor: pointer;
  padding: 0;
  transition: transform $duration-fast $ease-spring;

  &:hover {
    transform: scale(1.15);
  }
}

.chat-input__image-name {
  font-size: 10px;
  color: var(--neu-text-muted);
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.chat-input__wrapper {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: var(--glass-bg-surface, var(--neu-bg));
  border: 1px solid var(--glass-border, var(--neu-border));
  border-radius: 12px;
  padding: 8px 10px;
  transition: border-color $duration-normal $ease-out, box-shadow $duration-normal $ease-out;

  &:focus-within {
    border-color: rgba(var(--neu-accent-rgb), 0.3);
    box-shadow: 0 0 0 3px rgba(var(--neu-accent-rgb), 0.08);
  }
}

.chat-input__textarea {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  box-shadow: none;
  color: var(--neu-text-primary);
  font-family: $font-sans;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  max-height: 160px;
  overflow-y: auto;
  padding: 4px 0;

  &::placeholder {
    color: var(--neu-text-muted);
    font-style: italic;
  }

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--neu-scrollbar, var(--neu-bg-active));
    border-radius: 2px;
  }
}

.chat-input__send {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--neu-accent);
  border: none;
  border-radius: $radius-full;
  color: white;
  cursor: pointer;
  transition: transform $duration-fast $ease-spring,
              opacity $duration-fast $ease-out;

  &:hover:not(:disabled) {
    transform: scale(1.05);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.25;
    cursor: default;
  }
}

.chat-input__stop {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: $radius-full;
  cursor: pointer;
  position: relative;
  transition: transform $duration-fast $ease-spring;

  &:hover {
    transform: scale(1.08);

    .chat-input__stop-icon {
      background: var(--neu-accent);
    }
  }

  &:active {
    transform: scale(0.92);
  }
}

// 旋转弧线
.chat-input__stop-spinner {
  position: absolute;
  inset: 0;
  border-radius: $radius-full;
  border: 2.5px solid var(--glass-border, var(--neu-border));
  border-top-color: var(--neu-accent);
  animation: spin-stop 0.8s linear infinite;
}

// 中心停止方块
.chat-input__stop-icon {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: var(--neu-text-muted);
  transition: background $duration-fast $ease-out;
  z-index: 1;
}

@keyframes spin-stop {
  to { transform: rotate(360deg); }
}

// 下拉动画
.dropdown-fade-enter-active {
  transition: all $duration-fast $ease-out;
}

.dropdown-fade-leave-active {
  transition: all 0.1s $ease-out;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
