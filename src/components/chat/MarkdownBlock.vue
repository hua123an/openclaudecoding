<script setup lang="ts">
const props = defineProps<{
  html: string
}>()
</script>

<template>
  <div class="md-block" v-html="props.html"></div>
</template>

<style scoped lang="scss">
.md-block {
  font-size: inherit;
  line-height: 1.6;
  word-break: break-word;
}
</style>
