<script setup lang="ts">
import { ref, computed } from 'vue'
import { useChatStore } from '../../stores/chat'
import FileOpsList from './FileOpsList.vue'
import ToolCallsList from './ToolCallsList.vue'
import CommandHistory from './CommandHistory.vue'
import Icon from '../common/Icon.vue'

const props = defineProps<{
  sessionId: string
}>()

const emit = defineEmits<{
  close: []
}>()

const chatStore = useChatStore()
const activeTab = ref<'files' | 'tools' | 'commands'>('files')

const fileOps = computed(() => chatStore.getFileOps(props.sessionId))
const toolCalls = computed(() => chatStore.getToolCalls(props.sessionId))
const commands = computed(() => chatStore.getCommands(props.sessionId))
</script>

<template>
  <div class="execution-panel">
    <div class="execution-panel__header">
      <div class="execution-panel__tabs">
        <button
          class="execution-panel__tab"
          :class="{ 'execution-panel__tab--active': activeTab === 'files' }"
          @click="activeTab = 'files'"
        >
          <Icon name="file" :size="15" />
          <span class="execution-panel__count">{{ fileOps.length }}</span>
        </button>
        <button
          class="execution-panel__tab"
          :class="{ 'execution-panel__tab--active': activeTab === 'tools' }"
          @click="activeTab = 'tools'"
        >
          <Icon name="wrench" :size="15" />
          <span class="execution-panel__count">{{ toolCalls.length }}</span>
        </button>
        <button
          class="execution-panel__tab"
          :class="{ 'execution-panel__tab--active': activeTab === 'commands' }"
          @click="activeTab = 'commands'"
        >
          <Icon name="terminal" :size="15" />
          <span class="execution-panel__count">{{ commands.length }}</span>
        </button>
      </div>
      <button class="execution-panel__close" @click="emit('close')">
        <Icon name="x" :size="14" />
      </button>
    </div>
    <div class="execution-panel__body">
      <FileOpsList v-if="activeTab === 'files'" :items="fileOps" />
      <ToolCallsList v-if="activeTab === 'tools'" :items="toolCalls" />
      <CommandHistory v-if="activeTab === 'commands'" :items="commands" />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;

.execution-panel {
  width: 300px;
  background: var(--glass-bg-alt, var(--neu-bg-alt));
  backdrop-filter: blur(var(--glass-blur, 0));
  -webkit-backdrop-filter: blur(var(--glass-blur, 0));
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-left: 1px solid var(--glass-border, transparent);
}

.execution-panel__header {
  display: flex;
  align-items: center;
  padding: 0 6px 0 0;
  flex-shrink: 0;
  background: var(--glass-bg-alt, var(--neu-bg-alt));
  border-bottom: 1px solid var(--glass-border, transparent);
  position: relative;
  z-index: 1;
}

.execution-panel__tabs {
  display: flex;
  flex: 1;
}

.execution-panel__tab {
  flex: 1;
  padding: 12px 4px 10px;
  background: none;
  border: none;
  color: var(--neu-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: color $duration-fast $ease-out,
              box-shadow $duration-normal $ease-out;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  position: relative;
  border-radius: $radius-sm $radius-sm 0 0;

  &:hover {
    color: var(--neu-text-secondary);
    background: var(--neu-bg-hover);
  }

  &--active {
    color: var(--neu-accent);
    background: var(--glass-bg-surface, transparent);

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 20%;
      width: 60%;
      height: 3px;
      background: var(--neu-accent);
      border-radius: $radius-full $radius-full 0 0;
    }
  }
}

.execution-panel__count {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: $radius-full;
  border: 1px solid var(--glass-border, transparent);
  background: var(--glass-bg-surface, var(--neu-bg-surface));
  color: inherit;
  min-width: 18px;
  text-align: center;
  line-height: 1.4;
}

.execution-panel__close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--glass-border, transparent);
  color: var(--neu-text-muted);
  cursor: pointer;
  border-radius: $radius-sm;
  transition: color $duration-fast $ease-out,
              background $duration-fast $ease-out,
              transform $duration-fast $ease-out;

  &:hover {
    color: var(--neu-text-primary);
    background: var(--glass-bg-hover, var(--neu-bg-hover));
    transform: scale(1.08);
  }

  &:active {
    background: var(--glass-bg-active, var(--neu-bg-active));
    transform: scale(0.96);
  }
}

.execution-panel__body {
  flex: 1;
  overflow-y: auto;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--neu-scrollbar);
    border-radius: $radius-full;

    &:hover {
      background: var(--neu-scrollbar-hover);
    }
  }
}
</style>
