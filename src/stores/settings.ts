import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { ModelOption } from '../types'

/** 静态 fallback 模型列表（按 大杯/中杯/小杯 排列） */
export const fallbackModels: ModelOption[] = [
  { id: 'opus', label: 'Opus 4.6', description: '最强推理，复杂任务' },
  { id: 'opus-4-5', label: 'Opus 4.5', description: '' },
  { id: 'opus-4-1', label: 'Opus 4.1', description: '' },
  { id: 'opus-4', label: 'Opus 4', description: '' },
  { id: 'sonnet', label: 'Sonnet 4.5', description: '快速高效，日常首选' },
  { id: 'sonnet-4', label: 'Sonnet 4', description: '' },
  { id: 'sonnet37', label: 'Sonnet 3.7', description: '' },
  { id: 'sonnet35', label: 'Sonnet 3.5', description: '' },
  { id: 'haiku', label: 'Haiku 4.5', description: '极速响应，轻量任务' },
  { id: 'haiku-4', label: 'Haiku 4', description: '' },
  { id: 'haiku35', label: 'Haiku 3.5', description: '' },
]

/** 每个工具内置的模型列表（硬编码 fallback） */
const toolModelMap: Record<string, ModelOption[]> = {
  'claude-code': [
    { id: 'sonnet', label: 'Sonnet 4.5', description: '快速高效' },
    { id: 'opus', label: 'Opus 4.6', description: '最强推理' },
    { id: 'haiku', label: 'Haiku 4.5', description: '极速响应' },
  ],
  'gemini-cli': [
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  ],
  'codex': [
    { id: 'o3', label: 'o3' },
    { id: 'gpt-4.1', label: 'GPT-4.1' },
  ],
  'copilot': [
    { id: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
    { id: 'gpt-5.2', label: 'GPT-5.2' },
    { id: 'gpt-5', label: 'GPT-5' },
    { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro' },
  ],
  'qwen-code': [],
  'kimi-code': [],
}

/** 模型排序权重：opus > sonnet > haiku，同系列按版本倒序 */
function modelSortKey(id: string): number {
  const lower = id.toLowerCase()
  let tier = 3
  if (lower.includes('opus')) tier = 0
  else if (lower.includes('sonnet')) tier = 1
  else if (lower.includes('haiku')) tier = 2
  // 版本号越大越靠前（用负数）
  const verMatch = lower.match(/(\d+[\.\-]\d+|\d+)/)
  const ver = verMatch ? -parseFloat(verMatch[1].replace('-', '.')) : 0
  return tier * 1000 + ver
}

export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<'dark' | 'light'>('dark')
  const fontSize = ref(14)
  const fontFamily = ref("'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace")
  const selectedModel = ref<string>('sonnet')

  /** 动态模型列表（API 获取成功则替换 fallback，用于 claude-code） */
  const models = ref<ModelOption[]>([...fallbackModels])

  /** 每个工具当前选中的模型 */
  const selectedModels = ref<Record<string, string>>({
    'claude-code': 'sonnet',
    'gemini-cli': 'gemini-2.5-pro',
    'codex': 'o3',
    'copilot': 'claude-sonnet-4',
  })

  /** 思考模式开关 */
  const thinkingMode = ref(false)

  /** 是否已完成初始化加载（防止加载时触发 save） */
  let initialized = false

  function applyTheme(t: 'dark' | 'light') {
    theme.value = t
    if (t === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
    persistIfReady()
  }

  /** 持久化到本地文件 */
  function persistIfReady() {
    if (!initialized) return
    window.electronAPI.settingsSave({
      theme: theme.value,
      fontSize: fontSize.value,
      fontFamily: fontFamily.value,
      selectedModels: { ...selectedModels.value },
      thinkingMode: thinkingMode.value,
    }).catch(() => {})
  }

  /** 从本地文件恢复设置 */
  async function loadFromDisk() {
    try {
      const saved = await window.electronAPI.settingsLoad()
      if (saved) {
        if (saved.theme) applyTheme(saved.theme)
        if (saved.fontSize) fontSize.value = saved.fontSize
        if (saved.fontFamily) fontFamily.value = saved.fontFamily
        if (saved.selectedModels) {
          selectedModels.value = { ...selectedModels.value, ...saved.selectedModels }
          if (saved.selectedModels['claude-code']) {
            selectedModel.value = saved.selectedModels['claude-code']
          }
        }
        if (saved.thinkingMode !== undefined) thinkingMode.value = saved.thinkingMode
      }
    } catch {}
    initialized = true
  }

  // 初始化：先跟随系统主题（快速显示），然后异步从磁盘加载覆盖
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  applyTheme(mq.matches ? 'dark' : 'light')
  loadFromDisk()

  // 监听系统主题变化（仅当用户没有手动设置时）
  function onSystemChange(e: MediaQueryListEvent) {
    applyTheme(e.matches ? 'dark' : 'light')
  }
  mq.addEventListener('change', onSystemChange)

  // 自动保存：监听会触发改变的 ref
  watch([fontSize, fontFamily, thinkingMode], () => persistIfReady())

  function setModel(modelId: string) {
    selectedModel.value = modelId
  }

  /** 获取指定工具的模型列表 */
  function getModelsForTool(toolId: string): ModelOption[] {
    // claude-code 使用动态获取的模型列表（如果有）
    if (toolId === 'claude-code' && models.value.length > 0) {
      return models.value
    }
    return toolModelMap[toolId] || []
  }

  /** 获取指定工具当前选中的模型 */
  function getSelectedModel(toolId: string): string {
    return selectedModels.value[toolId] || ''
  }

  /** 设置指定工具的模型 */
  function setModelForTool(toolId: string, modelId: string) {
    selectedModels.value[toolId] = modelId
    // 同步旧的 selectedModel（兼容）
    if (toolId === 'claude-code') {
      selectedModel.value = modelId
    }
    persistIfReady()
  }

  /** 切换思考模式 */
  function toggleThinking() {
    thinkingMode.value = !thinkingMode.value
  }

  /**
   * 自动选择模型：当 API 加载出模型列表后，
   * 如果当前选中的模型不在列表中，优先选带 opus 的，其次选第一个
   */
  function autoSelectModelForTool(toolId: string, list: ModelOption[]) {
    if (list.length === 0) return
    const current = selectedModels.value[toolId]
    // 如果当前选中的模型已存在于列表中，不做改动
    if (current && list.some(m => m.id === current)) return
    // 优先选 opus 模型（列表已按 modelSortKey 排序，opus 在前）
    const opusModel = list.find(m => m.id.toLowerCase().includes('opus'))
    const chosen = opusModel || list[0]
    selectedModels.value[toolId] = chosen.id
    if (toolId === 'claude-code') {
      selectedModel.value = chosen.id
    }
  }

  /** 从 Claude Code settings.json 加载当前模型 + 从 API 动态加载模型列表 */
  async function loadModelFromSettings() {
    try {
      const settings = await window.electronAPI.readClaudeSettings()
      if (settings?.model) {
        selectedModel.value = settings.model
        selectedModels.value['claude-code'] = settings.model
      }
    } catch {}

    // 动态获取模型列表
    try {
      const apiModels = await window.electronAPI.listModels()
      if (apiModels && apiModels.length > 0) {
        const list: ModelOption[] = apiModels.map((m) => ({
          id: m.id,
          label: m.name || m.id,
          description: '',
        }))
        // 按 opus > sonnet > haiku 排序
        list.sort((a, b) => modelSortKey(a.id) - modelSortKey(b.id))
        models.value = list

        // 自动选择：如果当前选中的模型不在新列表中，选第一个（排序后优先 opus）
        autoSelectModelForTool('claude-code', list)
      }
    } catch {}
  }

  return {
    theme,
    fontSize,
    fontFamily,
    selectedModel,
    models,
    selectedModels,
    thinkingMode,
    applyTheme,
    setModel,
    getModelsForTool,
    getSelectedModel,
    setModelForTool,
    toggleThinking,
    loadModelFromSettings,
  }
})
