<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '../../stores/session'

const store = useSessionStore()

const activeToolName = computed(() => {
  if (!store.activeSession) return ''
  return store.tools.find((t) => t.id === store.activeSession!.toolId)?.name || ''
})

const totalSessions = computed(() =>
  store.workspaces.reduce((sum, ws) => sum + ws.sessions.length, 0)
)
</script>

<template>
  <div class="statusbar">
    <div class="statusbar__left">
      <span v-if="activeToolName" class="statusbar__item statusbar__tool">
        <span class="statusbar__dot"></span>
        {{ activeToolName }}
      </span>
      <span v-if="store.activeSession" class="statusbar__item statusbar__path">
        {{ store.activeSession.projectPath }}
      </span>
    </div>
    <div class="statusbar__right">
      <span class="statusbar__item statusbar__stats">
        {{ store.workspaces.length }} projects · {{ totalSessions }} sessions
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;

.statusbar {
  height: $statusbar-height;
  background: var(--glass-bg-alt);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-top: 1px solid var(--glass-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  font-size: 11px;
  font-family: $font-sans;
  color: var(--neu-text-muted);
  flex-shrink: 0;
}

.statusbar__left,
.statusbar__right {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.statusbar__left {
  flex: 1;
  overflow: hidden;
}

.statusbar__item {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color $duration-fast $ease-out;
}

.statusbar__tool {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--neu-accent);
  font-weight: 500;
  flex-shrink: 0;
}

.statusbar__dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--neu-accent);
  flex-shrink: 0;
  box-shadow: 0 0 4px rgba(var(--neu-accent-rgb), 0.5);
}

.statusbar__path {
  font-family: $font-mono;
  font-size: 10px;
  color: var(--neu-text-muted);
  letter-spacing: -0.02em;
  min-width: 0;
}

.statusbar__stats {
  color: var(--neu-text-muted);
  flex-shrink: 0;
}
</style>
