<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '../../stores/session'
import { useChatStore } from '../../stores/chat'
import Icon from '../common/Icon.vue'

const store = useSessionStore()
const chatStore = useChatStore()

const activeToolName = computed(() => {
  if (!store.activeSession) return ''
  return store.tools.find((t) => t.id === store.activeSession!.toolId)?.name || ''
})

const totalSessions = computed(() =>
  store.workspaces.reduce((sum, ws) => sum + ws.sessions.length, 0)
)

const sessionUsage = computed(() => {
  if (!store.activeSessionId) return null
  const usage = chatStore.getSessionUsage(store.activeSessionId)
  if (usage.totalInput === 0 && usage.totalOutput === 0) return null
  return usage
})

function fmtTokens(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}
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
      <span v-if="sessionUsage" class="statusbar__item statusbar__tokens">
        <Icon name="zap" :size="11" />
        {{ fmtTokens(sessionUsage.totalInput) }} in / {{ fmtTokens(sessionUsage.totalOutput) }} out
      </span>
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

.statusbar__tokens {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--neu-accent);
  font-family: $font-mono;
  font-size: 10px;
  flex-shrink: 0;
}
</style>
