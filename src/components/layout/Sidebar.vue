<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSessionStore } from '../../stores/session'
import { useProjectStore } from '../../stores/project'
import { useChatStore } from '../../stores/chat'
import { useRouter } from 'vue-router'
import Icon from '../common/Icon.vue'
import FileBrowser from '../common/FileBrowser.vue'

const store = useSessionStore()
const projectStore = useProjectStore()
const chatStore = useChatStore()
const router = useRouter()

// 新建会话：选择工具的下拉
const showToolPicker = ref(false)
const toolPickerForPath = ref<string | null>(null) // 给哪个 workspace 创建会话
const showFileBrowser = ref(false)

onMounted(async () => {
  await projectStore.loadRecent()
})

/** 顶部 "+ Start conversation" */
function handleStartConversation() {
  showFileBrowser.value = true
}

/** 文件浏览器选择目录后 */
function handleFileSelect(dir: string) {
  showFileBrowser.value = false
  projectStore.setCurrentAndAddRecent(dir)
  toolPickerForPath.value = dir
  showToolPicker.value = true
}

/** 文件浏览器取消 */
function handleFileBrowserCancel() {
  showFileBrowser.value = false
}

/** workspace 行的 "+" 按钮 */
function handleAddSession(wsPath: string) {
  toolPickerForPath.value = wsPath
  showToolPicker.value = true
}

/** 选择工具后创建会话（不启动工具，等用户发第一条消息时再启动） */
async function handlePickTool(toolId: string) {
  const path = toolPickerForPath.value
  if (!path) return

  showToolPicker.value = false
  toolPickerForPath.value = null

  // 先加载该项目的历史 CLI session
  await store.loadCliSessions(toolId, path)

  // 如果没有任何历史 session，创建一个新的
  const ws = store.workspaces.find(w => w.path === path)
  if (!ws || ws.sessions.length === 0) {
    const newSession = store.createSession(toolId, path)
    router.push(`/session/${newSession.id}`)
  } else {
    // 激活最新的 session
    const latest = ws.sessions[ws.sessions.length - 1]
    router.push(`/session/${latest.id}`)
  }
}

function closeToolPicker() {
  showToolPicker.value = false
  toolPickerForPath.value = null
}

/** 导航到插件/设置页面时，先清除活跃会话，使 router-view 可见 */
function goToPlugins() {
  router.push('/plugins')
}

function goToSettings() {
  router.push('/settings')
}
</script>

<template>
  <aside class="sidebar">
    <!-- macOS 交通灯区域 -->
    <div class="sidebar__dragbar"></div>

    <!-- 新建会话按钮 -->
    <div class="sidebar__new-wrap">
      <button class="sidebar__new-btn" @click="handleStartConversation">
        <span class="sidebar__new-icon">
          <Icon name="plus" :size="15" />
        </span>
        <span class="sidebar__new-text">Start conversation</span>
      </button>
    </div>

    <!-- Workspaces 区域 -->
    <div class="sidebar__section">
      <div class="sidebar__section-label">WORKSPACES</div>

      <div class="workspace-list">
        <div
          v-for="ws in store.workspaces"
          :key="ws.path"
          class="workspace"
        >
          <!-- Workspace 行 -->
          <div
            class="workspace__header"
            :class="{ 'workspace__header--active': store.activeWorkspace?.path === ws.path }"
          >
            <button class="workspace__toggle" @click="store.toggleWorkspace(ws.path)">
              <span class="workspace__arrow" :class="{ 'workspace__arrow--open': ws.expanded }">
                <Icon name="chevron-right" :size="14" />
              </span>
            </button>
            <Icon name="folder" :size="15" class="workspace__folder-icon" />
            <span class="workspace__name" @click="store.toggleWorkspace(ws.path)">{{ ws.name }}</span>
            <button class="workspace__add" @click.stop="handleAddSession(ws.path)" title="新建会话">
              <Icon name="plus" :size="14" />
            </button>
          </div>

          <!-- Sessions 列表 -->
          <div v-if="ws.expanded" class="workspace__sessions">
            <div
              v-for="session in ws.sessions"
              :key="session.id"
              class="session-item"
              :class="{ 'session-item--active': session.id === store.activeSessionId }"
              @click="router.push(`/session/${session.id}`)"
            >
              <span v-if="chatStore.isWaiting(session.id)" class="session-item__pulse"></span>
              <span v-else class="session-item__indicator"></span>
              <Icon name="message-circle" :size="14" class="session-item__icon" />
              <span class="session-item__title">{{ session.title }}</span>
              <span v-if="session.cliSessionId" class="session-item__cli-badge" :title="session.cliSessionId">
                {{ session.cliSessionId.slice(0, 8) }}
              </span>
              <button
                class="session-item__close"
                @click.stop="store.removeSession(session.id)"
                title="关闭会话"
              >
                <Icon name="x" :size="12" />
              </button>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-if="store.workspaces.length === 0" class="sidebar__empty">
          <div class="sidebar__empty-icon">
            <Icon name="folder" :size="28" />
          </div>
          <p>还没有打开的项目</p>
          <p class="sidebar__empty-hint">点击上方按钮开始</p>
        </div>
      </div>
    </div>

    <!-- 底部导航 -->
    <div class="sidebar__footer">
      <button class="sidebar__footer-btn" @click="goToPlugins">
        <Icon name="package" :size="16" />
        <span>Plugins</span>
      </button>
      <button class="sidebar__footer-btn" @click="goToSettings">
        <Icon name="settings" :size="16" />
        <span>Settings</span>
      </button>
    </div>

    <!-- 自定义文件浏览器 -->
    <FileBrowser
      :visible="showFileBrowser"
      @select="handleFileSelect"
      @cancel="handleFileBrowserCancel"
    />

    <!-- 工具选择浮层 -->
    <Teleport to="body">
      <Transition name="picker-fade">
        <div v-if="showToolPicker" class="tool-picker-overlay" @click.self="closeToolPicker">
          <Transition name="picker-scale" appear>
            <div class="tool-picker">
              <div class="tool-picker__header">
                <span class="tool-picker__header-text">选择 AI Coding Agent</span>
                <button class="tool-picker__close" @click="closeToolPicker">
                  <Icon name="x" :size="16" />
                </button>
              </div>
              <div class="tool-picker__list">
                <button
                  v-for="tool in store.installedTools"
                  :key="tool.id"
                  class="tool-picker__item"
                  @click="handlePickTool(tool.id)"
                >
                  <span class="tool-picker__icon">{{ tool.name.charAt(0) }}</span>
                  <span class="tool-picker__info">
                    <span class="tool-picker__name">{{ tool.name }}</span>
                    <span class="tool-picker__version">{{ tool.version }}</span>
                  </span>
                  <Icon name="chevron-right" :size="14" class="tool-picker__chevron" />
                </button>
                <div v-if="store.installedTools.length === 0" class="tool-picker__empty">
                  <Icon name="alert-circle" :size="20" class="tool-picker__empty-icon" />
                  <span>未检测到已安装的 AI Coding 工具</span>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </aside>
</template>

<style scoped lang="scss">
@use '../../styles/variables' as *;

// ============================================
// Sidebar — Neumorphism Style
// ============================================

.sidebar {
  width: $sidebar-width;
  height: 100%;
  background: var(--glass-bg-alt);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-right: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
}

// macOS 交通灯拖拽区
.sidebar__dragbar {
  height: $titlebar-height;
  -webkit-app-region: drag;
  flex-shrink: 0;
}

// ============ 新建按钮（新拟态凸起胶囊） ============
.sidebar__new-wrap {
  padding: 0 12px 12px;
  flex-shrink: 0;
}

.sidebar__new-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 14px;
  background: var(--glass-bg-surface);
  border: 1px solid var(--glass-border);
  border-radius: $radius-full;
  color: var(--neu-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  overflow: hidden;
  transition: all $duration-fast $ease-out;

  &:hover {
    color: var(--neu-text-primary);
    background: var(--glass-bg-hover);
    border-color: var(--glass-border-strong);
  }

  &:active {
    background: var(--glass-bg-active);
    transform: scale(0.98);
  }
}

.sidebar__new-icon {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: $radius-full;
  // 保留渐变背景
  background: var(--neu-accent);
  color: #fff;
  flex-shrink: 0;
}

.sidebar__new-text {
  flex: 1;
  text-align: left;
}

// ============ Section ============
.sidebar__section {
  flex: 1;
  overflow-y: auto;
  padding: 0 0 8px;

  // 自定义滚动条
  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--neu-scrollbar);
    border-radius: $radius-full;

    &:hover {
      background: var(--neu-scrollbar-hover);
    }
  }
}

.sidebar__section-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--neu-text-muted);
  text-transform: uppercase;
  letter-spacing: 1.2px;
  padding: 12px 16px 8px;
}

.sidebar__empty {
  padding: 32px 16px;
  text-align: center;
  color: var(--neu-text-muted);
  font-size: 13px;

  p {
    margin-bottom: 4px;
  }
}

.sidebar__empty-icon {
  margin-bottom: 12px;
  opacity: 0.3;
}

.sidebar__empty-hint {
  font-size: 12px;
  opacity: 0.5;
}

// ============ Workspace ============
.workspace {
  margin-bottom: 2px;
}

.workspace__header {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 5px 8px 5px 4px;
  margin: 0 6px;
  border-radius: $radius-md;
  cursor: default;
  transition: all $duration-fast $ease-out;

  &:hover {
    background: var(--glass-bg-hover);

    .workspace__add {
      opacity: 1;
    }

    .workspace__name {
      color: var(--neu-text-primary);
    }
  }

  &--active {
    .workspace__name {
      color: var(--neu-text-primary);
    }
  }
}

.workspace__toggle {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--neu-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
}

.workspace__arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform $duration-fast $ease-out;

  &--open {
    transform: rotate(90deg);
  }
}

.workspace__folder-icon {
  color: var(--neu-text-muted);
  margin-right: 6px;
  flex-shrink: 0;
  transition: color $duration-fast $ease-out;

  .workspace__header:hover & {
    color: var(--neu-accent);
  }
}

.workspace__name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--neu-text-secondary);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color $duration-fast $ease-out;
}

.workspace__add {
  opacity: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--neu-text-muted);
  cursor: pointer;
  border-radius: $radius-sm;
  flex-shrink: 0;
  padding: 0;
  transition: all $duration-fast $ease-out;

  &:hover {
    color: var(--neu-text-primary);
    background: var(--glass-bg-active);
  }

  &:active {
    background: var(--glass-bg-active);
  }
}

// ============ Sessions 列表 ============
.workspace__sessions {
  padding: 2px 0;
}

// ============ Session 项 ============
.session-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px 5px 14px;
  margin: 1px 6px;
  border-radius: $radius-md;
  cursor: pointer;
  transition: all $duration-fast $ease-out;

  &:hover {
    background: var(--glass-bg-hover);

    .session-item__close {
      opacity: 1;
    }

    .session-item__icon {
      color: var(--neu-text-secondary);
    }
  }

  // 选中态 — 毛玻璃 + 左侧指示条
  &--active {
    background: var(--glass-bg-surface);
    border: 1px solid var(--glass-border);
    margin: 1px 5px;

    .session-item__indicator {
      opacity: 1;
      transform: scaleY(1);
    }

    .session-item__title {
      color: var(--neu-text-primary);
    }

    .session-item__icon {
      color: var(--neu-accent);
    }

    &:hover {
      background: var(--glass-bg-surface);
    }
  }
}

// 左侧选中指示条
.session-item__indicator {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%) scaleY(0);
  width: 3px;
  height: 16px;
  background: var(--neu-accent);
  border-radius: $radius-full;
  opacity: 0;
  transition: all $duration-fast $ease-out;
}

// 运行中脉冲圆点
.session-item__pulse {
  position: absolute;
  left: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 6px;
  height: 6px;
  border-radius: $radius-full;
  background: var(--neu-success, var(--neu-accent));
  animation: session-pulse 1.4s ease-in-out infinite;
  z-index: 1;

  &::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: $radius-full;
    background: rgba(var(--neu-accent-rgb), 0.3);
    animation: session-pulse-ring 1.4s ease-in-out infinite;
  }
}

@keyframes session-pulse {
  0%, 100% {
    opacity: 1;
    transform: translateY(-50%) scale(1);
  }
  50% {
    opacity: 0.6;
    transform: translateY(-50%) scale(0.75);
  }
}

@keyframes session-pulse-ring {
  0%, 100% {
    opacity: 0.4;
    transform: scale(1);
  }
  50% {
    opacity: 0;
    transform: scale(1.8);
  }
}

.session-item__icon {
  color: var(--neu-text-muted);
  flex-shrink: 0;
  transition: color $duration-fast $ease-out;
}

.session-item__title {
  flex: 1;
  font-size: 13px;
  color: var(--neu-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color $duration-fast $ease-out;
}

// CLI Session ID pill badge
.session-item__cli-badge {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--neu-accent);
  font-family: $font-mono;
  padding: 1px 6px;
  background: rgba(var(--neu-accent-rgb), 0.1);
  border-radius: $radius-full;
  border: 1px solid var(--glass-border);
  line-height: 1.4;
}

.session-item__close {
  opacity: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--neu-text-muted);
  cursor: pointer;
  border-radius: $radius-sm;
  flex-shrink: 0;
  padding: 0;
  transition: all $duration-fast $ease-out;

  &:hover {
    color: var(--neu-error);
    background: var(--glass-bg-hover);
  }
}

// ============ Footer ============
.sidebar__footer {
  flex-shrink: 0;
  padding: 6px 8px;
  // 毛玻璃分隔线
  position: relative;
  -webkit-app-region: no-drag;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 12px;
    right: 12px;
    height: 1px;
    background: var(--glass-border);
  }
}

.sidebar__footer-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 10px;
  background: none;
  border: none;
  border-radius: $radius-md;
  color: var(--neu-text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: all $duration-fast $ease-out;

  &:hover {
    color: var(--neu-text-secondary);
    background: var(--glass-bg-hover);
  }
}

// ============ Tool Picker 弹窗 ============
.tool-picker-overlay {
  position: fixed;
  inset: 0;
  background: var(--neu-overlay);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.tool-picker {
  width: 380px;
  background: var(--glass-bg-alt);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border-strong);
  border-radius: $radius-xl;
  overflow: hidden;
  box-shadow: var(--glass-shadow), 0 20px 60px rgba(0, 0, 0, 0.3);
}

.tool-picker__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 14px;
  // 毛玻璃分隔线代替 border-bottom
  position: relative;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 12px;
    right: 12px;
    height: 1px;
    background: var(--glass-border);
  }
}

.tool-picker__header-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--neu-text-primary);
}

.tool-picker__close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--glass-border);
  color: var(--neu-text-muted);
  cursor: pointer;
  border-radius: $radius-sm;
  transition: all $duration-fast $ease-out;
  padding: 0;

  &:hover {
    color: var(--neu-text-primary);
    background: var(--glass-bg-hover);
  }
}

.tool-picker__list {
  padding: 8px;
  max-height: 340px;
  overflow-y: auto;
}

.tool-picker__item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  background: var(--glass-bg-alt);
  border: none;
  border-radius: $radius-md;
  color: var(--neu-text-primary);
  cursor: pointer;
  transition: all $duration-fast $ease-out;
  text-align: left;
  margin-bottom: 4px;

  &:last-child {
    margin-bottom: 0;
  }

  &:hover {
    background: var(--glass-bg-hover);

    .tool-picker__chevron {
      opacity: 1;
      transform: translateX(2px);
    }
  }
}

.tool-picker__icon {
  width: 38px;
  height: 38px;
  border-radius: $radius-md;
  // 保留渐变背景
  background: var(--neu-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
  color: white;
  flex-shrink: 0;
  box-shadow: var(--glass-shadow-sm);
}

.tool-picker__info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.tool-picker__name {
  font-size: 13px;
  font-weight: 500;
}

.tool-picker__version {
  font-size: 11px;
  color: var(--neu-text-muted);
  margin-top: 2px;
}

.tool-picker__chevron {
  color: var(--neu-text-muted);
  opacity: 0;
  flex-shrink: 0;
  transition: all $duration-fast $ease-out;
}

.tool-picker__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 20px;
  text-align: center;
  color: var(--neu-text-muted);
  font-size: 13px;
}

.tool-picker__empty-icon {
  opacity: 0.4;
}

// ============ Transitions ============
.picker-fade-enter-active,
.picker-fade-leave-active {
  transition: opacity $duration-normal $ease-out;
}

.picker-fade-enter-from,
.picker-fade-leave-to {
  opacity: 0;
}

.picker-scale-enter-active {
  transition: all $duration-normal $ease-spring;
}

.picker-scale-leave-active {
  transition: all $duration-fast $ease-out;
}

.picker-scale-enter-from {
  opacity: 0;
  transform: scale(0.92);
}

.picker-scale-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
