# OpenCoding

AI Coding Agent 统一桌面客户端，一个界面管理多个 AI 编程工具。

![Electron](https://img.shields.io/badge/Electron-30-47848F?logo=electron&logoColor=white)
![Vue](https://img.shields.io/badge/Vue-3-4FC08D?logo=vue.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 支持工具

| 工具 | 状态 | 流式输出 | 图片上传 | 会话恢复 |
|------|------|----------|----------|----------|
| Claude Code | ✅ | stream-json | ✅ base64 管道 | ✅ --resume |
| Gemini CLI | ✅ | stream-json | - | ✅ -r |
| Codex | ✅ | JSONL | ✅ -i 参数 | ✅ resume |
| Qwen Code | ✅ | 文本 | - | ✅ -c |
| Kimi Code | ✅ | 文本 | - | ✅ -c |
| GitHub Copilot | ✅ | 文本 | - | ✅ --resume |

## 功能特性

- **多工具统一界面** — 侧边栏管理多个 Workspace，每个可选不同 AI 工具
- **macOS 毛玻璃风格** — Glassmorphism UI，支持 Light/Dark 主题切换
- **流式消息输出** — stream-json / JSONL / 纯文本三种模式，实时显示 AI 回复
- **模型选择器** — 输入框内切换模型，每个工具独立的模型列表
- **Thinking 模式** — 可折叠的思考过程展示，一键展开/收起
- **图片上传** — 支持文件选择和剪贴板粘贴，base64 编码传递给 CLI
- **插件管理** — 安装、卸载、启用/禁用 Claude Code 插件
- **会话持久化** — Workspace 状态自动保存，重启恢复
- **Markdown 渲染** — 代码高亮、表格、引用完整支持

## 技术栈

- **框架**: Electron 30 + Vue 3 + TypeScript + Vite 5
- **状态管理**: Pinia
- **终端模拟**: xterm.js + node-pty
- **样式**: Sass (SCSS) + CSS Custom Properties
- **打包**: electron-builder (DMG / NSIS / AppImage)

## 快速开始

### 前置要求

- Node.js >= 18
- bun (推荐) 或 npm
- 至少安装一个支持的 AI CLI 工具

### 安装

```bash
# 克隆仓库
git clone https://github.com/hua123an/openclaudecoding.git
cd openclaudecoding

# 安装依赖
bun install

# 重建原生模块 (node-pty)
bun run rebuild
```

### 开发

```bash
bun run dev
```

### 打包

```bash
# 当前平台打包
bun run build
```

构建产物输出到 `release/` 目录。

## 项目结构

```
openclaudecoding/
├── electron/                 # Electron 主进程
│   ├── main.ts              # 主进程入口，窗口创建
│   ├── preload.ts           # 预加载脚本，暴露 IPC API
│   ├── adapters/            # CLI 工具适配器
│   │   ├── base.ts          # 适配器接口定义
│   │   ├── generic.ts       # 通用适配器实现
│   │   └── index.ts         # 各工具配置 + stream 解析器
│   ├── ipc/handlers.ts      # IPC 消息处理
│   ├── services/
│   │   ├── messageRunner.ts # 进程管理 + 流式输出解析
│   │   ├── toolDetector.ts  # CLI 工具检测
│   │   ├── projectManager.ts# 项目目录管理
│   │   └── sessionList.ts   # CLI 会话列表
│   └── pty/ptyManager.ts    # PTY 管理器
├── src/                      # Vue 渲染进程
│   ├── components/
│   │   ├── chat/            # 聊天组件 (消息卡片、输入框、Markdown)
│   │   ├── layout/          # 布局 (侧边栏、标签栏、状态栏)
│   │   ├── session/         # 会话视图
│   │   └── common/          # 通用组件 (Icon)
│   ├── stores/              # Pinia 状态管理
│   ├── views/               # 页面视图
│   ├── styles/              # 全局样式 + 主题变量
│   └── types/               # TypeScript 类型定义
├── electron-builder.json5    # 打包配置
└── vite.config.ts            # Vite 构建配置
```

## 架构说明

### 消息流程

```
用户输入 → SessionView → IPC (message:send)
  → Adapter.buildMessageCommand() → MessageRunner.send()
    → node-pty spawn shell → CLI 进程
      → stream-json/text 解析 → IPC 事件回传
        → ChatStore 更新 → MessageCard 渲染
```

### 适配器系统

每个 CLI 工具通过 `GenericAdapter` 配置化接入，只需定义命令、参数、解析器：

```typescript
new GenericAdapter({
  id: 'claude-code',
  command: 'claude',
  printModeArgs: ['-p'],
  outputFormatArgs: ['--output-format', 'stream-json', '--verbose'],
  inputFormatArgs: ['--input-format', 'stream-json'],
  useStreamJson: true,
  parseStreamEvent: parseClaudeStreamEvent,
  // ...
})
```

## 下载

前往 [Releases](https://github.com/hua123an/openclaudecoding/releases) 下载对应平台的安装包：

- **macOS**: `.dmg`
- **Windows**: `.exe` (NSIS 安装程序)
- **Linux**: `.AppImage`

## License

MIT
