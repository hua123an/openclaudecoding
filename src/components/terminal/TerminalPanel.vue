<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useSettingsStore } from '../../stores/settings'

const props = defineProps<{
  sessionId: string
}>()

const settings = useSettingsStore()
const terminalRef = ref<HTMLDivElement>()

let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let cleanupData: (() => void) | null = null
let cleanupExit: (() => void) | null = null
let resizeObserver: ResizeObserver | null = null

function initTerminal() {
  if (!terminalRef.value) return

  terminal = new Terminal({
    theme: {
      background: '#1a1b26',
      foreground: '#c0caf5',
      cursor: '#c0caf5',
      cursorAccent: '#1a1b26',
      selectionBackground: '#33467c',
      selectionForeground: '#c0caf5',
      black: '#15161e',
      red: '#f7768e',
      green: '#9ece6a',
      yellow: '#e0af68',
      blue: '#7aa2f7',
      magenta: '#bb9af7',
      cyan: '#7dcfff',
      white: '#a9b1d6',
      brightBlack: '#414868',
      brightRed: '#f7768e',
      brightGreen: '#9ece6a',
      brightYellow: '#e0af68',
      brightBlue: '#7aa2f7',
      brightMagenta: '#bb9af7',
      brightCyan: '#7dcfff',
      brightWhite: '#c0caf5',
    },
    fontSize: settings.fontSize,
    fontFamily: settings.fontFamily,
    cursorBlink: true,
    cursorStyle: 'bar',
    allowProposedApi: true,
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.loadAddon(new WebLinksAddon())

  terminal.open(terminalRef.value)

  nextTick(() => {
    fitAddon?.fit()
  })

  // 终端输入 → 主进程 PTY
  terminal.onData((data) => {
    window.electronAPI.ptyWrite(props.sessionId, data)
  })

  // 主进程 PTY 输出 → 终端
  cleanupData = window.electronAPI.onPtyData(props.sessionId, (data) => {
    terminal?.write(data)
  })

  cleanupExit = window.electronAPI.onPtyExit(props.sessionId, (_code) => {
    terminal?.write('\r\n\x1b[90m[进程已退出]\x1b[0m\r\n')
  })

  // 终端尺寸变化 → 通知主进程
  terminal.onResize(({ cols, rows }) => {
    window.electronAPI.ptyResize({ sessionId: props.sessionId, cols, rows })
  })

  // 容器大小变化 → 自适应
  resizeObserver = new ResizeObserver(() => {
    fitAddon?.fit()
  })
  resizeObserver.observe(terminalRef.value)
}

onMounted(() => {
  initTerminal()
})

onBeforeUnmount(() => {
  cleanupData?.()
  cleanupExit?.()
  resizeObserver?.disconnect()
  terminal?.dispose()
  terminal = null
  fitAddon = null
})

// 当字号变化时重新设置
watch(() => settings.fontSize, (val) => {
  if (terminal) {
    terminal.options.fontSize = val
    fitAddon?.fit()
  }
})
</script>

<template>
  <div class="terminal-panel">
    <div ref="terminalRef" class="terminal-panel__container"></div>
  </div>
</template>

<style scoped lang="scss">
.terminal-panel {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.terminal-panel__container {
  width: 100%;
  height: 100%;
}

// xterm.js 全局样式补丁
:deep(.xterm) {
  padding: 8px;
  height: 100%;
}

:deep(.xterm-viewport) {
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-thumb {
    background: #414868;
    border-radius: 3px;
  }
}
</style>
