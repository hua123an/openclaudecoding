/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    APP_ROOT: string;
    VITE_PUBLIC: string;
  }
}

interface ElectronAPI {
  // Message（命令模式）
  messageSend(opts: {
    sessionId: string;
    toolId: string;
    projectDir: string;
    message: string;
    isFirst: boolean;
    cliSessionId?: string;
    imagePaths?: string[];
    model?: string;
    thinking?: boolean;
  }): Promise<{ success: boolean; error?: string }>;
  messageCancel(sessionId: string): Promise<{ success: boolean }>;
  onMessageData(
    sessionId: string,
    callback: (data: string) => void,
  ): () => void;
  onMessageSessionId(
    sessionId: string,
    callback: (cliSessionId: string) => void,
  ): () => void;
  onMessageDone(
    sessionId: string,
    callback: (code: number) => void,
  ): () => void;
  onMessageError(
    sessionId: string,
    callback: (error: string) => void,
  ): () => void;

  // Image Dialog
  openImageDialog(): Promise<string[]>;
  saveClipboardImage(base64: string, mimeType: string): Promise<string>;

  // PTY（保留）
  ptyCreate(
    opts: import("../src/types").PtyCreateOptions,
  ): Promise<{ success: boolean }>;
  ptyWrite(sessionId: string, data: string): Promise<{ success: boolean }>;
  ptyResize(
    opts: import("../src/types").PtyResizeOptions,
  ): Promise<{ success: boolean }>;
  ptyDestroy(sessionId: string): Promise<{ success: boolean }>;
  onPtyData(sessionId: string, callback: (data: string) => void): () => void;
  onPtyExit(sessionId: string, callback: (code: number) => void): () => void;

  // CLI Session 列表
  listCliSessions(opts: {
    toolId: string;
    projectPath: string;
  }): Promise<
    { sessionId: string; title: string; timestamp: string; toolId: string }[]
  >;
  loadCliSessionMessages(opts: {
    toolId: string;
    projectPath: string;
    cliSessionId: string;
  }): Promise<
    { role: "user" | "assistant"; content: string; timestamp: string }[]
  >;

  // Tool
  toolList(): Promise<import("../src/types").CliToolInfo[]>;
  toolDetectAll(): Promise<import("../src/types").ToolDetectResult[]>;
  toolDetect(
    toolId: string,
  ): Promise<import("../src/types").ToolDetectResult | null>;

  // Project
  projectOpenDialog(): Promise<string | null>;
  projectRecent(): Promise<import("../src/types").ProjectInfo[]>;
  projectAddRecent(path: string): Promise<{ success: boolean }>;
  projectRemoveRecent(path: string): Promise<{ success: boolean }>;

  // Workspace Persistence
  workspaceLoad(): Promise<{
    workspaces: import("../src/types").Workspace[];
    activeSessionId: string | null;
  }>;
  workspaceSave(state: {
    workspaces: import("../src/types").Workspace[];
    activeSessionId: string | null;
  }): Promise<{ success: boolean }>;

  // Claude Settings
  readClaudeSettings(): Promise<any>;
  listModels(): Promise<{ id: string; name: string; created: string }[]>;

  // Plugin 管理
  pluginList(): Promise<import("../src/types").PluginInfo[]>;
  pluginMarketplaceList(): Promise<import("../src/types").MarketplacePlugin[]>;
  pluginInstall(name: string): Promise<{ success: boolean; message: string }>;
  pluginUninstall(name: string): Promise<{ success: boolean; message: string }>;
  pluginToggle(
    name: string,
    enable: boolean,
  ): Promise<{ success: boolean; message: string }>;
  listSkills(): Promise<import("../src/types").SkillItem[]>;
}

interface Window {
  electronAPI: ElectronAPI;
}
