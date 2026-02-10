<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue'

const props = defineProps<{
  html: string
}>()

const blockRef = ref<HTMLDivElement>()

// SVG 图标（内联，避免依赖 Icon 组件在 DOM 注入场景）
const copySvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
const checkSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'

/** 拦截链接点击，用系统浏览器打开 */
function handleClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const anchor = target.closest('a')
  if (anchor && anchor.href) {
    e.preventDefault()
    e.stopPropagation()
    window.electronAPI.openExternal(anchor.href)
  }
}

/** 给所有 <pre> 代码块注入复制按钮 */
function addCopyButtons() {
  const el = blockRef.value
  if (!el) return

  el.querySelectorAll('pre').forEach((pre) => {
    if (pre.querySelector('.code-copy-btn')) return
    pre.style.position = 'relative'

    const btn = document.createElement('button')
    btn.className = 'code-copy-btn'
    btn.title = 'Copy code'
    btn.innerHTML = copySvg

    btn.addEventListener('click', (ev) => {
      ev.preventDefault()
      ev.stopPropagation()
      const code = pre.querySelector('code')?.textContent || pre.textContent || ''
      navigator.clipboard.writeText(code).then(() => {
        btn.innerHTML = checkSvg
        btn.classList.add('code-copy-btn--done')
        setTimeout(() => {
          btn.innerHTML = copySvg
          btn.classList.remove('code-copy-btn--done')
        }, 1500)
      })
    })

    pre.appendChild(btn)
  })
}

onMounted(() => addCopyButtons())
watch(() => props.html, () => nextTick(() => addCopyButtons()))
</script>

<template>
  <div class="md-block" ref="blockRef" v-html="props.html" @click="handleClick"></div>
</template>

<style scoped lang="scss">
.md-block {
  font-size: inherit;
  line-height: 1.6;
  word-break: break-word;
  user-select: text;

  :deep(a) {
    color: var(--neu-accent, #5b8def);
    text-decoration: none;
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }

  :deep(pre) {
    position: relative;
  }

  :deep(.code-copy-btn) {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--glass-bg-surface, var(--neu-bg-surface));
    border: 1px solid var(--glass-border, var(--neu-border));
    border-radius: 6px;
    color: var(--neu-text-muted);
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
    z-index: 2;
    padding: 0;

    &:hover {
      color: var(--neu-text-secondary);
      background: var(--glass-bg-hover, var(--neu-bg-hover));
    }
  }

  :deep(.code-copy-btn--done) {
    color: var(--neu-success, #43a047);
    opacity: 1;
  }

  :deep(pre:hover .code-copy-btn) {
    opacity: 1;
  }
}
</style>
