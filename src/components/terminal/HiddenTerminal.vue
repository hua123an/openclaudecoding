<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

const props = defineProps<{
  sessionId: string
}>()

const terminalRef = ref<HTMLDivElement>()

let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let cleanupExit: (() => void) | null = null

function initTerminal() {
  if (!terminalRef.value) return

  terminal = new Terminal({
    theme: { background: '#1a1b26', foreground: '#c0caf5' },
    fontSize: 12,
    cols: 120,
    rows: 30,
    allowProposedApi: true,
  })

  fitAddon = new FitAddon()
  terminal.loadAddon(fitAddon)
  terminal.open(terminalRef.value)

  // PTY 输出 → 隐藏终端（维护终端状态）
  // 注意：PTY 数据监听在 SessionView 中统一管理
  cleanupExit = window.electronAPI.onPtyExit(props.sessionId, () => {
    // 仅记录退出
  })
}

onMounted(() => {
  initTerminal()
})

onBeforeUnmount(() => {
  cleanupExit?.()
  terminal?.dispose()
  terminal = null
  fitAddon = null
})

/** 将 PTY 数据写入隐藏终端以维护状态 */
function writeToTerminal(data: string) {
  terminal?.write(data)
}

defineExpose({ writeToTerminal })
</script>

<template>
  <div class="hidden-terminal" aria-hidden="true">
    <div ref="terminalRef"></div>
  </div>
</template>

<style scoped>
.hidden-terminal {
  position: absolute;
  left: -9999px;
  width: 960px;
  height: 600px;
  overflow: hidden;
  pointer-events: none;
}
</style>
