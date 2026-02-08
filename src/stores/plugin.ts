import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PluginInfo, MarketplacePlugin, SkillItem } from '../types'

export const usePluginStore = defineStore('plugin', () => {
  const installedPlugins = ref<PluginInfo[]>([])
  const marketplacePlugins = ref<MarketplacePlugin[]>([])
  const skills = ref<SkillItem[]>([])
  const loading = ref(false)

  async function loadInstalled() {
    loading.value = true
    try {
      installedPlugins.value = await window.electronAPI.pluginList()
    } catch (err) {
      console.warn('[plugin store] failed to load installed:', err)
      installedPlugins.value = []
    } finally {
      loading.value = false
    }
  }

  async function loadMarketplace() {
    loading.value = true
    try {
      marketplacePlugins.value = await window.electronAPI.pluginMarketplaceList()
    } catch (err) {
      console.warn('[plugin store] failed to load marketplace:', err)
      marketplacePlugins.value = []
    } finally {
      loading.value = false
    }
  }

  async function loadSkills() {
    try {
      skills.value = await window.electronAPI.listSkills()
    } catch (err) {
      console.warn('[plugin store] failed to load skills:', err)
      skills.value = []
    }
  }

  async function install(name: string) {
    loading.value = true
    try {
      await window.electronAPI.pluginInstall(name)
      await loadInstalled()
    } finally {
      loading.value = false
    }
  }

  async function uninstall(name: string) {
    loading.value = true
    try {
      await window.electronAPI.pluginUninstall(name)
      await loadInstalled()
    } finally {
      loading.value = false
    }
  }

  async function toggle(name: string, enable: boolean) {
    try {
      await window.electronAPI.pluginToggle(name, enable)
      // 更新本地状态
      const plugin = installedPlugins.value.find(p => p.name === name || p.id === name)
      if (plugin) plugin.enabled = enable
    } catch (err) {
      console.warn('[plugin store] toggle failed:', err)
    }
  }

  return {
    installedPlugins,
    marketplacePlugins,
    skills,
    loading,
    loadInstalled,
    loadMarketplace,
    loadSkills,
    install,
    uninstall,
    toggle,
  }
})
