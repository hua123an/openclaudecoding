<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useSessionStore } from '../stores/session'
import { useRouter } from 'vue-router'
import Icon from '../components/common/Icon.vue'

const settings = useSettingsStore()
const sessionStore = useSessionStore()
const router = useRouter()

/** 有可选模型的已安装工具 */
const toolsWithModels = computed(() => {
  return sessionStore.tools
    .filter(t => t.installed && settings.getModelsForTool(t.id).length > 0)
})
</script>

<template>
  <div class="settings">
    <div class="settings__header">
      <button class="settings__back" @click="router.back()">
        <Icon name="arrow-left" :size="16" />
        <span>返回</span>
      </button>
      <h1 class="settings__title">设置</h1>
    </div>

    <div class="settings__content">
      <!-- 外观 -->
      <div class="settings__group">
        <h2 class="settings__group-title">外观</h2>

        <div class="settings__row">
          <label class="settings__label">主题</label>
          <div class="settings__pills">
            <button
              class="settings__pill"
              :class="{ 'settings__pill--active': settings.theme === 'dark' }"
              @click="settings.applyTheme('dark')"
            >
              <Icon name="moon" :size="13" />
              深色
            </button>
            <button
              class="settings__pill"
              :class="{ 'settings__pill--active': settings.theme === 'light' }"
              @click="settings.applyTheme('light')"
            >
              <Icon name="sun" :size="13" />
              浅色
            </button>
          </div>
        </div>

        <div class="settings__row">
          <label class="settings__label">终端字号</label>
          <input
            class="settings__input settings__input--number"
            type="number"
            :value="settings.fontSize"
            @input="settings.fontSize = Number(($event.target as HTMLInputElement).value)"
            min="10"
            max="24"
          />
        </div>

        <div class="settings__row">
          <label class="settings__label">终端字体</label>
          <input
            class="settings__input"
            type="text"
            :value="settings.fontFamily"
            @input="settings.fontFamily = ($event.target as HTMLInputElement).value"
          />
        </div>
      </div>

      <!-- 模型 -->
      <div v-if="toolsWithModels.length > 0" class="settings__group">
        <h2 class="settings__group-title">模型</h2>

        <div
          v-for="tool in toolsWithModels"
          :key="tool.id"
          class="settings__row"
        >
          <label class="settings__label">{{ tool.name }}</label>
          <select
            class="settings__select"
            :value="settings.getSelectedModel(tool.id)"
            @change="settings.setModelForTool(tool.id, ($event.target as HTMLSelectElement).value)"
          >
            <option
              v-for="m in settings.getModelsForTool(tool.id)"
              :key="m.id"
              :value="m.id"
            >
              {{ m.label || m.id }}
            </option>
          </select>
        </div>
      </div>

      <!-- 高级 -->
      <div class="settings__group">
        <h2 class="settings__group-title">高级</h2>

        <div class="settings__row">
          <label class="settings__label">
            <Icon name="lightbulb" :size="14" />
            思考模式
          </label>
          <button
            class="settings__toggle"
            :class="{ 'settings__toggle--on': settings.thinkingMode }"
            @click="settings.toggleThinking()"
          >
            <span class="settings__toggle-thumb"></span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.settings {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 40px 40px 32px;
  background: var(--glass-bg, var(--neu-bg));
}

// ---- Header ----
.settings__header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 40px;
}

.settings__back {
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

.settings__title {
  font-size: 22px;
  font-weight: 700;
  color: var(--neu-text-primary);
  letter-spacing: -0.01em;
}

// ---- Content ----
.settings__content {
  max-width: 580px;
}

// ---- Group ----
.settings__group {
  margin-bottom: 36px;
}

.settings__group-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--neu-accent);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 18px;
  padding-bottom: 12px;
  padding-left: 12px;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1px;
    background: var(--glass-border, var(--neu-border));
  }

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 2px;
    bottom: 12px;
    width: 3px;
    border-radius: 2px;
    background: var(--neu-accent);
    box-shadow: 0 0 8px rgba(var(--neu-accent-rgb), 0.3);
  }
}

// ---- Row ----
.settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;

  & + & {
    margin-top: 2px;
  }
}

.settings__label {
  font-size: 14px;
  color: var(--neu-text-secondary);
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

// ---- Input / Select ----
.settings__input,
.settings__select {
  width: 200px;
  height: 36px;
  padding: 0 12px;
  background: var(--glass-bg-surface, var(--neu-bg));
  border: 1px solid var(--glass-border, var(--neu-border));
  border-radius: $radius-md;
  font-size: 13px;
  font-family: $font-sans;
  color: var(--neu-text-primary);
  outline: none;
  transition:
    border-color $duration-fast $ease-out;

  &:hover {
    border-color: var(--glass-border-strong, var(--neu-border-strong));
  }

  &:focus {
    border-color: rgba(var(--neu-accent-rgb), 0.4);
    box-shadow: 0 0 0 3px rgba(var(--neu-accent-rgb), 0.1);
  }
}

.settings__input--number {
  width: 90px;
  text-align: center;
}

.settings__select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239BA3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 30px;
  cursor: pointer;
}

// ---- Theme Pills ----
.settings__pills {
  display: flex;
  gap: 4px;
  background: var(--glass-bg-surface, var(--neu-bg));
  border: 1px solid var(--glass-border, var(--neu-border));
  border-radius: $radius-md;
  padding: 3px;
}

.settings__pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-family: $font-sans;
  font-weight: 500;
  color: var(--neu-text-muted);
  background: transparent;
  cursor: pointer;
  transition: all $duration-fast $ease-out;

  &:hover {
    color: var(--neu-text-primary);
    background: var(--glass-bg-hover, var(--neu-bg-hover));
  }

  &--active {
    color: var(--neu-accent);
    background: rgba(var(--neu-accent-rgb), 0.12);
  }
}

// ---- Toggle Switch ----
.settings__toggle {
  position: relative;
  width: 44px;
  height: 24px;
  border: none;
  border-radius: 12px;
  background: var(--glass-bg-surface, var(--neu-bg-active));
  cursor: pointer;
  transition: background $duration-fast $ease-out;
  padding: 0;

  &--on {
    background: var(--neu-accent);
  }
}

.settings__toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform $duration-fast $ease-out;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);

  .settings__toggle--on & {
    transform: translateX(20px);
  }
}
</style>
