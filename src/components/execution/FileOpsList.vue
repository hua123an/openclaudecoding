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

function typeIcon(type: string): string {
  const icons: Record<string, string> = {
    file_read: 'file', file_write: 'edit', file_edit: 'edit', file_delete: 'trash',
  }
  return icons[type] || 'file'
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    file_read: 'Read', file_write: 'Write', file_edit: 'Edit', file_delete: 'Delete',
  }
  return labels[type] || type
}

function typeColor(type: string): string {
  const colors: Record<string, string> = {
    file_read: 'info', file_write: 'success', file_edit: 'warning', file_delete: 'error',
  }
  return colors[type] || 'info'
}
</script>

<template>
  <div class="file-ops-list">
    <div v-if="sortedItems.length === 0" class="file-ops-list__empty">
      <Icon name="file" :size="20" />
      <span>暂无文件操作</span>
    </div>
    <div
      v-for="item in sortedItems"
      :key="item.id"
      class="file-op-item"
    >
      <span class="file-op-item__icon">
        <Icon :name="typeIcon(item.type)" :size="14" />
      </span>
      <span class="file-op-item__path">{{ item.label }}</span>
      <span
        class="file-op-item__type"
        :class="`file-op-item__type--${typeColor(item.type)}`"
      >{{ typeLabel(item.type) }}</span>
      <span class="file-op-item__time">{{ formatTime(item.timestamp) }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;

.file-ops-list {
  padding: 6px 0;
}

.file-ops-list__empty {
  padding: 32px 20px;
  text-align: center;
  color: var(--neu-text-muted);
  font-size: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.file-op-item {
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

.file-op-item__icon {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-sm;
  background: var(--glass-bg-surface, var(--neu-bg-surface));
  color: var(--neu-text-secondary);
  border: 1px solid var(--glass-border, transparent);
}

.file-op-item__path {
  flex: 1;
  color: var(--neu-text-primary);
  font-family: $font-mono;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-op-item__type {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: $radius-full;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  border: 1px solid var(--glass-border, transparent);
  background: var(--glass-bg-surface, var(--neu-bg-surface));

  &--info {
    color: var(--neu-accent);
  }

  &--success {
    color: var(--neu-success);
  }

  &--warning {
    color: var(--neu-warning);
  }

  &--error {
    color: var(--neu-error);
  }
}

.file-op-item__time {
  flex-shrink: 0;
  color: var(--neu-text-muted);
  font-size: 10px;
  font-family: $font-mono;
}
</style>
