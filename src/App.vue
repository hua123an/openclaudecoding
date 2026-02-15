<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Sidebar from './components/layout/Sidebar.vue'
import TabBar from './components/layout/TabBar.vue'
import StatusBar from './components/layout/StatusBar.vue'
import SessionView from './components/session/SessionView.vue'
import { useSessionStore } from './stores/session'
import { useSettingsStore } from './stores/settings'
import { useChatStore } from './stores/chat'

const store = useSessionStore()
const chatStore = useChatStore()
useSettingsStore() // triggers theme watch

const route = useRoute()
const router = useRouter()

// 是否在会话路由上
const isSessionRoute = computed(() => route.name === 'session')

// 初始化：加载持久化的 workspace 数据 + 工具列表
onMounted(async () => {
  await store.init()
  await store.loadTools()
  // detectTools 不阻塞 UI，后台异步执行
  store.detectTools()

  // 初始化后，如果有持久化的 activeSessionId 且当前在首页，导航到对应会话
  if (store.activeSessionId && route.path === '/') {
    router.replace(`/session/${store.activeSessionId}`)
  }
})

// 路由 → store 同步：当路由是 /session/:id 时，同步 activeSessionId
watch(() => route.params.id, (id) => {
  if (id && typeof id === 'string') {
    store.activeSessionId = id
  }
}, { immediate: true })

/** 只挂载活跃 + 正在流式输出的 session，节省内存 */
const mountedSessions = computed(() => {
  const all = store.workspaces.flatMap(ws => ws.sessions)
  return all.filter(s =>
    s.id === store.activeSessionId || chatStore.isWaiting(s.id)
  )
})
</script>

<template>
  <div class="app-layout">
    <Sidebar />
    <div class="app-layout__main">
      <TabBar v-if="isSessionRoute" />
      <div class="app-layout__content">
        <!-- 同时挂载所有 session，切换时仅切换可见性，保持后台 IPC 监听不断 -->
        <SessionView
          v-for="session in mountedSessions"
          v-show="isSessionRoute && session.id === store.activeSessionId"
          :key="session.id"
          :session-id="session.id"
        />
        <!-- 非会话路由：首页/设置/插件 -->
        <router-view v-if="!isSessionRoute" />
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
  position: relative;
  overflow: hidden;
  background: var(--glass-bg, var(--neu-bg));
}
</style>
