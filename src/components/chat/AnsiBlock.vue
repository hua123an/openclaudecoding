<script setup lang="ts">
const props = defineProps<{
  html: string
}>()
</script>

<template>
  <div class="ansi-block" v-html="props.html"></div>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;

.ansi-block {
  font-family: $font-mono;
  font-size: inherit;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

<style lang="scss">
/* ANSI class 全局样式 (ansi_up use_classes=true) */
.ansi-block {
  .ansi-black-fg   { color: #15161e; }
  .ansi-red-fg     { color: #f7768e; }
  .ansi-green-fg   { color: #9ece6a; }
  .ansi-yellow-fg  { color: #e0af68; }
  .ansi-blue-fg    { color: #7aa2f7; }
  .ansi-magenta-fg { color: #bb9af7; }
  .ansi-cyan-fg    { color: #7dcfff; }
  .ansi-white-fg   { color: #a9b1d6; }

  .ansi-bright-black-fg   { color: #414868; }
  .ansi-bright-red-fg     { color: #f7768e; }
  .ansi-bright-green-fg   { color: #9ece6a; }
  .ansi-bright-yellow-fg  { color: #e0af68; }
  .ansi-bright-blue-fg    { color: #7aa2f7; }
  .ansi-bright-magenta-fg { color: #bb9af7; }
  .ansi-bright-cyan-fg    { color: #7dcfff; }
  .ansi-bright-white-fg   { color: #c0caf5; }

  .ansi-black-bg   { background: #15161e; }
  .ansi-red-bg     { background: #f7768e; }
  .ansi-green-bg   { background: #9ece6a; }
  .ansi-yellow-bg  { background: #e0af68; }
  .ansi-blue-bg    { background: #7aa2f7; }
  .ansi-magenta-bg { background: #bb9af7; }
  .ansi-cyan-bg    { background: #7dcfff; }
  .ansi-white-bg   { background: #a9b1d6; }

  .ansi-bold { font-weight: 700; }
  .ansi-italic { font-style: italic; }
  .ansi-underline { text-decoration: underline; }
  .ansi-dim { opacity: 0.7; }
}
</style>
