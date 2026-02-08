<script setup lang="ts">
import { useSettingsStore } from '../stores/settings'
import { useRouter } from 'vue-router'
import Icon from '../components/common/Icon.vue'

const settings = useSettingsStore()
const router = useRouter()
</script>

<template>
  <div class="settings">
    <div class="settings__header">
      <button class="settings__back" @click="router.push('/')">
        <Icon name="arrow-left" :size="16" />
        <span>返回</span>
      </button>
      <h1 class="settings__title">设置</h1>
    </div>

    <div class="settings__content">
      <div class="settings__group">
        <h2 class="settings__group-title">外观</h2>

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

  // 细线分隔替代内凹 box-shadow
  &::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1px;
    background: var(--glass-border, var(--neu-border));
  }

  // 左侧指示条
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

  // 用间距分隔，不用 border
  & + & {
    margin-top: 2px;
  }
}

.settings__label {
  font-size: 14px;
  color: var(--neu-text-secondary);
  font-weight: 500;
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
</style>
