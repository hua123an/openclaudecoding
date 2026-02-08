<script setup lang="ts">
import Icon from '../components/common/Icon.vue'
</script>

<template>
  <div class="home">
    <div class="home__hero">
      <div class="home__logo">
        <div class="home__logo-circle">
          <Icon name="zap" :size="32" />
        </div>
      </div>

      <h1 class="home__title">OpenCoding</h1>
      <p class="home__subtitle">AI Coding Agent 统一桌面客户端</p>

      <div class="home__tools">
        <span class="home__tool home__tool--claude">Claude Code</span>
        <span class="home__tool home__tool--gemini">Gemini CLI</span>
        <span class="home__tool home__tool--codex">Codex</span>
        <span class="home__tool home__tool--qwen">Qwen Code</span>
        <span class="home__tool home__tool--kimi">Kimi Code</span>
        <span class="home__tool home__tool--copilot">Copilot</span>
      </div>

      <p class="home__hint">Click "Start conversation" to begin</p>
    </div>

    <div class="home__shortcuts">
      <div class="home__shortcut">
        <div class="home__shortcut-keys">
          <kbd>⌘</kbd>
          <span class="home__shortcut-sep">+</span>
          <kbd>N</kbd>
        </div>
        <span class="home__shortcut-label">新建会话</span>
      </div>
      <div class="home__shortcut">
        <div class="home__shortcut-keys">
          <kbd>⌘</kbd>
          <span class="home__shortcut-sep">+</span>
          <kbd>O</kbd>
        </div>
        <span class="home__shortcut-label">打开项目</span>
      </div>
      <div class="home__shortcut">
        <div class="home__shortcut-keys">
          <kbd>⌘</kbd>
          <span class="home__shortcut-sep">+</span>
          <kbd>,</kbd>
        </div>
        <span class="home__shortcut-label">设置</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '../styles/variables' as *;

.home {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 56px;
  background: var(--glass-bg, var(--neu-bg));
}

// ---- Hero ----
.home__hero {
  text-align: center;
}

// ---- Logo ----
.home__logo {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.home__logo-circle {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--neu-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: var(--glass-shadow, var(--neu-raised));
  animation: logo-pulse 3s ease-in-out infinite alternate;
}

@keyframes logo-pulse {
  0% {
    box-shadow:
      var(--glass-shadow),
      0 0 16px rgba(var(--neu-accent-rgb), 0.15);
  }
  100% {
    box-shadow:
      var(--glass-shadow),
      0 0 32px rgba(var(--neu-accent-rgb), 0.3),
      0 0 56px rgba(var(--neu-accent-rgb), 0.1);
  }
}

// ---- Title ----
.home__title {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-bottom: 8px;
  background: var(--neu-accent);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

// ---- Subtitle ----
.home__subtitle {
  font-size: 15px;
  color: var(--neu-text-secondary);
  margin-bottom: 20px;
}

// ---- Tool Pills ----
.home__tools {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-bottom: 28px;
}

.home__tool {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: $radius-full;
  font-size: 12px;
  font-weight: 600;
  font-family: $font-sans;
  letter-spacing: 0.01em;
  background: var(--glass-bg-surface, var(--neu-bg));
  border: 1px solid var(--glass-border, var(--neu-border));
  transition:
    transform $duration-fast $ease-out,
    background $duration-fast $ease-out;

  &:hover {
    transform: translateY(-2px);
    background: var(--glass-bg-hover, var(--neu-bg-hover));
  }

  &--claude {
    color: var(--neu-warning);
  }
  &--gemini {
    color: var(--neu-accent);
  }
  &--codex {
    color: var(--neu-success);
  }
  &--qwen {
    color: var(--neu-purple);
  }
  &--kimi {
    color: var(--neu-error);
  }
  &--copilot {
    color: var(--neu-accent-hover);
  }
}

// ---- Hint ----
.home__hint {
  font-size: 13px;
  color: var(--neu-text-muted);
  opacity: 0.8;
}

// ---- Shortcuts ----
.home__shortcuts {
  display: flex;
  gap: 36px;
}

.home__shortcut {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  transition: transform $duration-fast $ease-out;

  &:hover {
    transform: translateY(-2px);

    kbd {
      background: var(--glass-bg-hover, var(--neu-bg-hover));
      border-color: var(--glass-border-strong, var(--neu-border-strong));
    }
  }
}

.home__shortcut-keys {
  display: flex;
  align-items: center;
  gap: 4px;

  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 30px;
    padding: 0 8px;
    background: var(--glass-bg-surface, var(--neu-bg));
    border: 1px solid var(--glass-border, var(--neu-border));
    border-radius: $radius-sm;
    font-size: 12px;
    font-family: $font-sans;
    color: var(--neu-text-secondary);
    transition:
      background $duration-fast $ease-out,
      border-color $duration-fast $ease-out;
  }
}

.home__shortcut-sep {
  font-size: 11px;
  color: var(--neu-text-muted);
  user-select: none;
}

.home__shortcut-label {
  font-size: 12px;
  color: var(--neu-text-muted);
}
</style>
