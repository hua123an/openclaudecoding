# OpenClaudeCoding — AI Coding Agent 统一桌面 GUI

## 项目定位

为 Claude Code、Gemini CLI、Codex、Qwen Code、Kimi Code、Copilot 等 AI Coding Agent CLI 工具
提供统一的桌面图形化操作界面。内嵌真实终端 + 增强 UI 展示。

---

## 整体架构

```
┌──────────────────────────────────────────────────────────┐
│                    Electron Main Process                  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  PTY Manager │  │ Tool Registry│  │ Project Manager│  │
│  │  (node-pty)  │  │ (适配器注册) │  │ (目录/历史)    │  │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                 │                   │          │
│         └─────────┬───────┴───────────┬───────┘          │
│                   │   IPC Bridge      │                  │
├───────────────────┼───────────────────┼──────────────────┤
│                   │  Renderer (Vue 3) │                  │
│                   │                   │                  │
│  ┌────────────────┴───────────────────┴───────────────┐  │
│  │                    App Layout                      │  │
│  │  ┌──────────┐ ┌─────────────────────────────────┐  │  │
│  │  │          │ │         Tab Bar                  │  │  │
│  │  │ Sidebar  │ ├─────────────────────────────────┤  │  │
│  │  │          │ │                                  │  │  │
│  │  │ • 项目   │ │    Terminal (xterm.js)           │  │  │
│  │  │ • 工具   │ │    + 增强输出面板                │  │  │
│  │  │ • 设置   │ │    (代码高亮/Diff/文件变更)      │  │  │
│  │  │          │ │                                  │  │  │
│  │  └──────────┘ └─────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 需要安装的核心依赖

### 生产依赖
- `xterm` + `xterm-addon-fit` + `xterm-addon-web-links` — 终端模拟
- `node-pty` — 伪终端（在主进程中运行 CLI 工具）
- `vue-router` — 路由管理
- `pinia` — 状态管理
- `@xterm/xterm` — xterm v5

### 开发依赖
- `sass` — CSS 预处理器
- `electron-rebuild` — node-pty 原生模块编译

---

## 分阶段实现计划

### Phase 1：核心基础设施（当前要做的）

**目标**：搭建应用骨架，实现内嵌终端 + 基本 UI 布局

#### 1.1 安装依赖 & 项目结构重组

```
src/
├── main.ts                     # Vue 入口
├── App.vue                     # 根组件（布局框架）
├── router/
│   └── index.ts                # 路由配置
├── stores/
│   ├── session.ts              # 会话状态管理
│   ├── project.ts              # 项目状态管理
│   └── settings.ts             # 设置状态管理
├── components/
│   ├── layout/
│   │   ├── Sidebar.vue         # 侧边栏
│   │   ├── TabBar.vue          # 标签栏
│   │   └── StatusBar.vue       # 状态栏
│   ├── terminal/
│   │   └── TerminalPanel.vue   # xterm.js 终端面板
│   ├── session/
│   │   └── SessionView.vue     # 单个会话视图
│   └── common/
│       └── Icon.vue            # 图标组件
├── views/
│   ├── HomeView.vue            # 首页/欢迎页
│   └── SettingsView.vue        # 设置页
├── types/
│   └── index.ts                # 全局类型定义
├── styles/
│   ├── variables.scss          # 样式变量
│   └── global.scss             # 全局样式
└── assets/

electron/
├── main.ts                     # Electron 主入口
├── preload.ts                  # 预加载脚本（扩展 IPC API）
├── pty/
│   └── ptyManager.ts           # PTY 进程管理器
├── adapters/
│   ├── base.ts                 # 适配器基类/接口
│   ├── claudeCode.ts           # Claude Code 适配器
│   ├── geminiCli.ts            # Gemini CLI 适配器
│   ├── codex.ts                # Codex 适配器
│   ├── qwenCode.ts             # Qwen Code 适配器
│   ├── kimiCode.ts             # Kimi Code 适配器
│   └── copilot.ts              # Copilot 适配器
├── services/
│   ├── toolDetector.ts         # 工具自动检测（which/where）
│   └── projectManager.ts       # 项目目录管理
└── ipc/
    └── handlers.ts             # IPC 消息处理器集中注册

```

#### 1.2 Electron 主进程改造

- **PTY Manager**：基于 node-pty 创建/销毁伪终端实例，每个会话对应一个 PTY
- **IPC Handlers**：
  - `pty:create` — 创建新终端会话
  - `pty:write` — 向终端写入数据
  - `pty:resize` — 终端尺寸变更
  - `pty:destroy` — 销毁终端
  - `tool:list` — 列出已安装的 CLI 工具
  - `tool:detect` — 检测某个工具是否安装
  - `project:open` — 打开项目目录
  - `project:recent` — 获取最近项目列表

#### 1.3 渲染进程 UI 布局

- 左侧 Sidebar：项目列表 + 工具选择器
- 顶部 TabBar：多会话标签页切换
- 主区域：xterm.js 终端面板
- 底部 StatusBar：当前工具、项目路径、连接状态

#### 1.4 终端集成

- xterm.js 集成，通过 IPC 与主进程 PTY 双向通信
- 终端主题跟随应用主题
- 支持终端尺寸自适应（fit addon）

---

### Phase 2：CLI 工具适配器系统

**目标**：实现通用适配器接口，支持所有目标 CLI 工具

#### 2.1 适配器接口设计

```typescript
interface CliToolAdapter {
  id: string                          // 唯一标识 如 'claude-code'
  name: string                        // 显示名称 如 'Claude Code'
  icon: string                        // 图标路径
  command: string                     // 可执行命令 如 'claude'
  detectCommand: string               // 检测命令 如 'claude --version'
  defaultArgs: string[]               // 默认启动参数

  detect(): Promise<boolean>          // 是否已安装
  getVersion(): Promise<string>       // 获取版本
  buildStartCommand(projectDir: string): string[]  // 构建启动命令
}
```

#### 2.2 各工具适配器

| 工具 | 命令 | 检测方式 |
|------|------|----------|
| Claude Code | `claude` | `claude --version` |
| Gemini CLI | `gemini` | `gemini --version` |
| Codex | `codex` | `codex --version` |
| Qwen Code | `qwen-code` | `qwen-code --version` |
| Kimi Code | `kimi-code` | `kimi-code --version` |
| Copilot | `github-copilot-cli` | `github-copilot-cli --version` |

#### 2.3 新建会话流程

1. 用户选择项目目录
2. 用户选择 CLI 工具
3. 通过适配器构建启动命令
4. PTY Manager 创建终端进程
5. xterm.js 绑定到该 PTY 实例

---

### Phase 3：增强 UI（后续迭代）

- 输出解析：识别代码块、文件路径、diff 等结构化内容
- 代码语法高亮面板
- Diff 视图（文件变更对比）
- 文件变更追踪面板
- Markdown 渲染

### Phase 4：高级功能（远期）

- 会话历史记录与搜索
- 工具配置管理（API Key、模型选择等）
- 快捷键系统
- 插件机制（用户自定义适配器）
- 自动更新

---

## Phase 1 具体实施步骤

1. **安装依赖**：xterm、node-pty、vue-router、pinia、sass
2. **创建目录结构**：按上述结构创建文件夹和文件
3. **实现 PTY Manager**：`electron/pty/ptyManager.ts`
4. **实现 IPC Handlers**：`electron/ipc/handlers.ts`
5. **扩展 preload.ts**：暴露 PTY 相关 API
6. **更新 main.ts**：注册 IPC handlers，窗口配置优化
7. **实现适配器基类 + 全部 6 个适配器**
8. **实现工具检测服务**：`electron/services/toolDetector.ts`
9. **实现 Vue 状态管理**：session store、project store、settings store
10. **实现 UI 布局组件**：Sidebar、TabBar、StatusBar
11. **实现终端面板组件**：TerminalPanel.vue（xterm.js 集成）
12. **实现会话视图**：SessionView.vue
13. **实现首页**：HomeView.vue（欢迎页 + 快速启动）
14. **实现设置页**：SettingsView.vue
15. **全局样式**：暗色主题、布局样式
16. **编译测试**：确保 TypeScript 编译通过 + 应用正常运行
