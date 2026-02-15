<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePluginStore } from '../stores/plugin'
import Icon from '../components/common/Icon.vue'

const router = useRouter()
const pluginStore = usePluginStore()
const activeTab = ref<'installed' | 'marketplace'>('installed')
const searchQuery = ref('')
const installingSet = ref(new Set<string>())

onMounted(async () => {
  await Promise.all([
    pluginStore.loadInstalled(),
    pluginStore.loadMarketplace(),
  ])
})

const filteredInstalled = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return pluginStore.installedPlugins
  return pluginStore.installedPlugins.filter(p =>
    (p.name || p.id).toLowerCase().includes(q) ||
    (p.description || '').toLowerCase().includes(q)
  )
})

const filteredMarketplace = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return pluginStore.marketplacePlugins
  return pluginStore.marketplacePlugins.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.description || '').toLowerCase().includes(q)
  )
})

const installedNames = computed(() =>
  new Set(pluginStore.installedPlugins.map(p => p.name || p.id))
)

async function handleInstall(name: string) {
  installingSet.value.add(name)
  try {
    await pluginStore.install(name)
  } finally {
    installingSet.value.delete(name)
  }
}

async function handleUninstall(name: string) {
  await pluginStore.uninstall(name)
}

async function handleToggle(name: string, enable: boolean) {
  await pluginStore.toggle(name, enable)
}

function refresh() {
  pluginStore.loadInstalled()
  pluginStore.loadMarketplace()
}
</script>

<template>
  <div class="plugin-view">
    <div class="plugin-view__header">
      <button class="plugin-view__back" @click="router.back()">
        <Icon name="arrow-left" :size="16" />
        <span>返回</span>
      </button>
      <h2 class="plugin-view__title">
        <Icon name="package" :size="18" />
        <span>插件管理</span>
      </h2>
      <button class="plugin-view__refresh" @click="refresh" title="刷新">
        <Icon name="refresh-cw" :size="14" />
      </button>
    </div>

    <!-- Tab 切换 -->
    <div class="plugin-view__tabs">
      <button
        class="plugin-view__tab"
        :class="{ 'plugin-view__tab--active': activeTab === 'installed' }"
        @click="activeTab = 'installed'"
      >
        已安装 ({{ pluginStore.installedPlugins.length }})
      </button>
      <button
        class="plugin-view__tab"
        :class="{ 'plugin-view__tab--active': activeTab === 'marketplace' }"
        @click="activeTab = 'marketplace'"
      >
        市场 ({{ pluginStore.marketplacePlugins.length }})
      </button>
    </div>

    <!-- 搜索栏 -->
    <div class="plugin-view__search">
      <Icon name="search" :size="14" class="plugin-view__search-icon" />
      <input
        v-model="searchQuery"
        class="plugin-view__search-input"
        placeholder="搜索插件..."
      />
    </div>

    <!-- Loading -->
    <div v-if="pluginStore.loading" class="plugin-view__loading">
      <Icon name="loader" :size="20" class="plugin-view__spinner" />
      <span>加载中...</span>
    </div>

    <!-- 已安装 -->
    <div v-else-if="activeTab === 'installed'" class="plugin-view__list">
      <div v-if="filteredInstalled.length === 0" class="plugin-view__empty">
        暂无已安装的插件
      </div>
      <div
        v-for="plugin in filteredInstalled"
        :key="plugin.id"
        class="plugin-card"
      >
        <div class="plugin-card__info">
          <div class="plugin-card__name">{{ plugin.name || plugin.id }}</div>
          <div class="plugin-card__meta">
            <span class="plugin-card__version">v{{ plugin.version }}</span>
            <span class="plugin-card__scope">{{ plugin.scope }}</span>
          </div>
          <div v-if="plugin.description" class="plugin-card__desc">{{ plugin.description }}</div>
        </div>
        <div class="plugin-card__actions">
          <button
            class="plugin-card__toggle"
            :class="{ 'plugin-card__toggle--on': plugin.enabled }"
            @click="handleToggle(plugin.name || plugin.id, !plugin.enabled)"
            :title="plugin.enabled ? '禁用' : '启用'"
          >
            <span class="plugin-card__toggle-knob"></span>
          </button>
          <button class="plugin-card__uninstall" @click="handleUninstall(plugin.name || plugin.id)" title="卸载">
            <Icon name="trash-2" :size="13" />
          </button>
        </div>
      </div>
    </div>

    <!-- 市场 -->
    <div v-else class="plugin-view__list">
      <div v-if="filteredMarketplace.length === 0" class="plugin-view__empty">
        暂无可用插件
      </div>
      <div
        v-for="plugin in filteredMarketplace"
        :key="plugin.name"
        class="plugin-card"
      >
        <div class="plugin-card__info">
          <div class="plugin-card__name">{{ plugin.name }}</div>
          <div class="plugin-card__meta">
            <span class="plugin-card__source">{{ plugin.source }}</span>
          </div>
          <div v-if="plugin.description" class="plugin-card__desc">{{ plugin.description }}</div>
        </div>
        <div class="plugin-card__actions">
          <button
            v-if="installedNames.has(plugin.name)"
            class="plugin-card__installed-mark"
            disabled
          >
            <Icon name="check" :size="12" />
            <span>已安装</span>
          </button>
          <button
            v-else
            class="plugin-card__install-btn"
            :disabled="installingSet.has(plugin.name)"
            @click="handleInstall(plugin.name)"
          >
            <Icon v-if="installingSet.has(plugin.name)" name="loader" :size="12" class="plugin-view__spinner" />
            <Icon v-else name="download" :size="12" />
            <span>{{ installingSet.has(plugin.name) ? '安装中...' : '安装' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
$radius-lg: 16px;
$radius-md: 10px;
$radius-sm: 6px;
$radius-full: 9999px;
$font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
$font-mono: 'JetBrains Mono', 'Fira Code', monospace;
$duration-fast: 0.15s;
$duration-normal: 0.25s;
$ease-out: cubic-bezier(0.25, 0.46, 0.45, 0.94);

.plugin-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow-y: auto;
  background: var(--glass-bg, var(--neu-bg));
}

.plugin-view__header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.plugin-view__back {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: transparent;
  border: 1px solid var(--glass-border, var(--neu-border));
  border-radius: $radius-md;
  color: var(--neu-text-secondary);
  font-size: 13px;
  font-family: $font-sans;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background $duration-fast $ease-out,
    color $duration-fast $ease-out;

  &:hover {
    color: var(--neu-text-primary);
    background: var(--glass-bg-hover, var(--neu-bg-hover));
  }

  &:active {
    background: var(--glass-bg-active, var(--neu-bg-active));
  }
}

.plugin-view__title {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--neu-text-primary);
  font-family: $font-sans;
  margin: 0;
}

.plugin-view__refresh {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--glass-border, var(--neu-border));
  border-radius: $radius-sm;
  background: transparent;
  color: var(--neu-text-muted);
  cursor: pointer;
  transition: all $duration-fast $ease-out;

  &:hover {
    color: var(--neu-accent);
    background: var(--glass-bg-hover, var(--neu-bg-hover));
  }

  &:active {
    background: var(--glass-bg-active, var(--neu-bg-active));
  }
}

// ── Tabs ──
.plugin-view__tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  background: var(--glass-bg-surface, var(--neu-bg));
  border-radius: $radius-md;
  padding: 3px;
  border: 1px solid var(--glass-border, transparent);
}

.plugin-view__tab {
  flex: 1;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--neu-text-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all $duration-fast $ease-out;
  font-family: $font-sans;

  &--active {
    background: var(--glass-bg-hover, var(--neu-bg-surface));
    color: var(--neu-accent);
    border: 1px solid var(--glass-border, transparent);
  }

  &:hover:not(&--active) {
    color: var(--neu-text-secondary);
  }
}

// ── Search ──
.plugin-view__search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: $radius-md;
  border: 1px solid var(--glass-border, var(--neu-border));
  background: var(--glass-bg-surface, var(--neu-bg));
  margin-bottom: 16px;
}

.plugin-view__search-icon {
  color: var(--neu-text-muted);
  flex-shrink: 0;
}

.plugin-view__search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: var(--neu-text-primary);
  font-size: 13px;
  font-family: $font-sans;

  &::placeholder {
    color: var(--neu-text-muted);
  }
}

// ── Loading ──
.plugin-view__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px;
  color: var(--neu-text-muted);
  font-size: 13px;
}

.plugin-view__spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.plugin-view__empty {
  text-align: center;
  padding: 40px;
  color: var(--neu-text-muted);
  font-size: 13px;
}

// ── Plugin Card ──
.plugin-view__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.plugin-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-radius: $radius-md;
  background: var(--glass-bg-surface, var(--neu-bg));
  border: 1px solid var(--glass-border, transparent);
  transition: background $duration-fast $ease-out;

  &:hover {
    background: var(--glass-bg-hover, var(--neu-bg-hover));
  }
}

.plugin-card__info {
  flex: 1;
  min-width: 0;
}

.plugin-card__name {
  font-size: 13px;
  font-weight: 600;
  color: var(--neu-text-primary);
  font-family: $font-sans;
}

.plugin-card__meta {
  display: flex;
  gap: 6px;
  margin-top: 3px;
}

.plugin-card__version,
.plugin-card__scope,
.plugin-card__source {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: $radius-full;
  background: var(--neu-bg-surface);
  color: var(--neu-text-muted);
}

.plugin-card__scope {
  color: var(--neu-accent);
}

.plugin-card__desc {
  font-size: 12px;
  color: var(--neu-text-secondary);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plugin-card__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-left: 12px;
}

// ── Toggle 开关 ──
.plugin-card__toggle {
  width: 36px;
  height: 20px;
  border-radius: $radius-full;
  border: 1px solid var(--glass-border, var(--neu-border));
  background: var(--glass-bg-surface, var(--neu-bg));
  cursor: pointer;
  position: relative;
  transition: background $duration-fast $ease-out, border-color $duration-fast $ease-out;

  &--on {
    background: var(--neu-accent);
    border-color: var(--neu-accent);
  }
}

.plugin-card__toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--neu-bg-surface);
  border: 1px solid var(--glass-border, transparent);
  transition: transform $duration-fast $ease-out;

  .plugin-card__toggle--on & {
    transform: translateX(16px);
    background: white;
    border-color: transparent;
  }
}

.plugin-card__uninstall {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--glass-border, var(--neu-border));
  border-radius: $radius-sm;
  background: transparent;
  color: var(--neu-text-muted);
  cursor: pointer;
  transition: all $duration-fast $ease-out;

  &:hover {
    color: var(--neu-error, #e53935);
    background: var(--glass-bg-hover, var(--neu-bg-hover));
  }

  &:active {
    background: var(--glass-bg-active, var(--neu-bg-active));
  }
}

.plugin-card__install-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border: none;
  border-radius: $radius-sm;
  background: var(--neu-accent);
  color: white;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all $duration-fast $ease-out;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: var(--glass-shadow-sm, 0 2px 8px rgba(0, 0, 0, 0.15));
  }

  &:active:not(:disabled) {
    transform: none;
  }

  &:disabled {
    opacity: 0.6;
    cursor: default;
  }
}

.plugin-card__installed-mark {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border: 1px solid var(--glass-border, transparent);
  border-radius: $radius-sm;
  background: var(--glass-bg-surface, var(--neu-bg-surface));
  color: var(--neu-success, #4caf50);
  font-size: 11px;
  font-weight: 500;
  cursor: default;
}
</style>
