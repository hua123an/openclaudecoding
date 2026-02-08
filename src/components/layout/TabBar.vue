<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useSessionStore } from '../../stores/session'
import { useSettingsStore } from '../../stores/settings'
import Icon from '../common/Icon.vue'

const store = useSessionStore()
const settingsStore = useSettingsStore()

defineProps<{ showExecPanel?: boolean }>()
const emit = defineEmits<{ 'toggle-exec-panel': [] }>()

const toolName = computed(() => {
  if (!store.activeSession) return ''
  return store.tools.find((t) => t.id === store.activeSession!.toolId)?.name || ''
})

onMounted(() => {
  settingsStore.loadModelFromSettings()
})
</script>

<template>
  <div class="topbar">
    <div class="topbar__left">
      <!-- 面包屑：workspace / session -->
      <template v-if="store.activeSession && store.activeWorkspace">
        <span class="topbar__crumb topbar__crumb--ws">{{ store.activeWorkspace.name }}</span>
        <span class="topbar__sep">
          <Icon name="chevron-right" :size="12" />
        </span>
        <span class="topbar__crumb topbar__crumb--session">{{ store.activeSession.title }}</span>
      </template>
    </div>
    <div class="topbar__right">
      <span v-if="toolName" class="topbar__badge">
        <span class="topbar__badge-dot"></span>
        {{ toolName }}
      </span>
      <button
        class="topbar__panel-btn"
        :class="{ 'topbar__panel-btn--active': showExecPanel }"
        @click="emit('toggle-exec-panel')"
        title="Toggle exec panel"
      >
        <Icon name="panel-right" :size="16" />
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;

.topbar {
  height: $tabbar-height;
  background: var(--glass-bg, var(--neu-bg));
  backdrop-filter: blur(var(--glass-blur, 0));
  -webkit-backdrop-filter: blur(var(--glass-blur, 0));
  border-bottom: 1px solid var(--glass-border, var(--neu-border));
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  -webkit-app-region: drag;
  flex-shrink: 0;
  position: relative;
}

.topbar__left {
  display: flex;
  align-items: center;
  gap: 0;
  -webkit-app-region: no-drag;
  min-width: 0;
}

.topbar__crumb {
  font-size: 13px;
  font-family: $font-sans;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color $duration-fast $ease-out;
}

.topbar__crumb--ws {
  color: var(--neu-text-muted);

  &:hover {
    color: var(--neu-text-secondary);
  }
}

.topbar__crumb--session {
  color: var(--neu-text-primary);
  font-weight: 500;
}

.topbar__sep {
  display: inline-flex;
  align-items: center;
  margin: 0 6px;
  color: var(--neu-text-muted);
  opacity: 0.6;
}

.topbar__right {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
  flex-shrink: 0;
}

.topbar__badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: $radius-full;
  background: var(--glass-bg-surface, var(--neu-bg-surface));
  color: var(--neu-accent);
  line-height: 1;
  border: 1px solid var(--glass-border, var(--neu-border));
  transition: background $duration-fast $ease-out;

  &:hover {
    background: var(--glass-bg-hover, var(--neu-bg-hover));
  }
}

.topbar__badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--neu-accent);
  flex-shrink: 0;
  box-shadow: 0 0 6px rgba(var(--neu-accent-rgb), 0.4);
}

.topbar__panel-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--glass-border, var(--neu-border));
  border-radius: $radius-sm;
  background: transparent;
  color: var(--neu-text-muted);
  cursor: pointer;
  transition: all $duration-fast $ease-out;

  &:hover {
    color: var(--neu-text-secondary);
    background: var(--glass-bg-hover, var(--neu-bg-hover));
  }

  &--active {
    color: var(--neu-accent);
    background: var(--glass-bg-active, var(--neu-bg-active));
    border-color: rgba(var(--neu-accent-rgb), 0.2);
  }
}
</style>
