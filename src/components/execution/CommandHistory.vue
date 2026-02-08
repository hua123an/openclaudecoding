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
</script>

<template>
  <div class="command-history">
    <div v-if="sortedItems.length === 0" class="command-history__empty">
      <Icon name="terminal" :size="20" />
      <span>暂无命令记录</span>
    </div>
    <div
      v-for="item in sortedItems"
      :key="item.id"
      class="command-item"
    >
      <span class="command-item__icon">
        <Icon name="play" :size="12" />
      </span>
      <span class="command-item__cmd">{{ item.label }}</span>
      <span class="command-item__time">{{ formatTime(item.timestamp) }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;

.command-history {
  padding: 6px 0;
}

.command-history__empty {
  padding: 32px 20px;
  text-align: center;
  color: var(--neu-text-muted);
  font-size: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.command-item {
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

.command-item__icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-full;
  background: var(--glass-bg-surface, var(--neu-bg-surface));
  color: var(--neu-success);
  border: 1px solid var(--glass-border, transparent);
}

.command-item__cmd {
  flex: 1;
  color: var(--neu-text-primary);
  font-family: $font-mono;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.command-item__time {
  flex-shrink: 0;
  color: var(--neu-text-muted);
  font-size: 10px;
  font-family: $font-mono;
}
</style>
