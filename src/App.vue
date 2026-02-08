<script setup lang="ts">
import { computed, onMounted } from 'vue'
import Sidebar from './components/layout/Sidebar.vue'
import TabBar from './components/layout/TabBar.vue'
import StatusBar from './components/layout/StatusBar.vue'
import SessionView from './components/session/SessionView.vue'
import { useSessionStore } from './stores/session'
import { useSettingsStore } from './stores/settings'

const store = useSessionStore()
useSettingsStore() // triggers theme watch

// 初始化：加载持久化的 workspace 数据 + 工具列表
onMounted(async () => {
  await store.init()
  await store.loadTools()
  // detectTools 不阻塞 UI，后台异步执行
  store.detectTools()
})

const hasActiveSession = computed(() => store.activeSession !== null)
</script>

<template>
  <div class="app-layout">
    <Sidebar />
    <div class="app-layout__main">
      <TabBar v-if="hasActiveSession" />
      <div class="app-layout__content">
        <!-- 有活跃会话时只挂载当前活跃 session（v-if 避免同时挂载所有 session） -->
        <template v-if="hasActiveSession && store.activeSessionId">
          <SessionView
            :key="store.activeSessionId"
            :session-id="store.activeSessionId"
          />
        </template>
        <!-- 无会话时显示路由页面 -->
        <router-view v-else />
      </div>
      <StatusBar />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use './styles/variables' as *;

.app-layout {
  width: 100%;
  height: 100%;
  display: flex;
}

.app-layout__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.app-layout__content {
  flex: 1;
  overflow: hidden;
  background: var(--glass-bg, var(--neu-bg));
}
</style>
