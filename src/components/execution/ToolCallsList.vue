<script setup lang="ts">
import { computed } from 'vue'
import type { ExecutionItem } from '../../types'
import Icon from '../common/Icon.vue'

const props = defineProps<{
  items: ExecutionItem[]
}>()

const sortedItems = computed(() =>
  [...props.items].sort((a, b) => b.timestamp - a.timestamp)
)

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function statusIcon(status: string): string {
  const icons: Record<string, string> = {
    running: 'loader', success: 'check', error: 'alert-circle',
  }
  return icons[status] || 'loader'
}
</script>

<template>
  <div class="tool-calls-list">
    <div v-if="sortedItems.length === 0" class="tool-calls-list__empty">
      <Icon name="wrench" :size="20" />
      <span>暂无工具调用</span>
    </div>
    <div
      v-for="item in sortedItems"
      :key="item.id"
      class="tool-call-item"
    >
      <span class="tool-call-item__icon">
        <Icon name="wrench" :size="14" />
      </span>
      <span class="tool-call-item__name">{{ item.label }}</span>
      <span
        class="tool-call-item__status"
        :class="`tool-call-item__status--${item.status}`"
      >
        <Icon
          :name="statusIcon(item.status)"
          :size="14"
          :class="{ 'tool-call-item__spin': item.status === 'running' }"
        />
      </span>
      <span class="tool-call-item__time">{{ formatTime(item.timestamp) }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;

.tool-calls-list {
  padding: 6px 0;
}

.tool-calls-list__empty {
  padding: 32px 20px;
  text-align: center;
  color: var(--neu-text-muted);
  font-size: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.tool-call-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin: 2px 0;
  font-size: 12px;
  transition: background $duration-fast $ease-out;
  border-radius: $radius-sm;

  &:hover {
    background: var(--neu-bg-hover);
  }
}

.tool-call-item__icon {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-sm;
  background: var(--glass-bg-surface, var(--neu-bg-surface));
  color: var(--neu-purple);
  border: 1px solid var(--glass-border, transparent);
}

.tool-call-item__name {
  flex: 1;
  color: var(--neu-text-primary);
  font-family: $font-mono;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tool-call-item__status {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: $radius-full;
  font-size: 13px;
  background: var(--glass-bg-surface, var(--neu-bg-surface));
  border: 1px solid var(--glass-border, transparent);

  &--running {
    color: var(--neu-warning);
  }

  &--success {
    color: var(--neu-success);
  }

  &--error {
    color: var(--neu-error);
  }
}

.tool-call-item__spin {
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.tool-call-item__time {
  flex-shrink: 0;
  color: var(--neu-text-muted);
  font-size: 10px;
  font-family: $font-mono;
}
</style>
