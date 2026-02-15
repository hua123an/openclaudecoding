import { GenericAdapter } from './generic'
import type { StreamEventResult } from './base'

/** 解析 Claude Code stream-json 的单行输出 */
function parseClaudeStreamEvent(line: string): StreamEventResult | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try {
    const obj = JSON.parse(trimmed)
    const result: StreamEventResult = {}

    // 从任意事件中提取 session_id
    if (obj.session_id) result.sessionId = obj.session_id

    // 完整 assistant 消息（非流式 chunk）
    if (obj.type === 'assistant' && obj.message?.content) {
      const texts = obj.message.content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text)
      if (texts.length > 0) result.text = texts.join('')
    }

    // 流式 content delta
    if (obj.type === 'content_block_delta' && obj.delta?.type === 'text_delta') {
      result.text = obj.delta.text
    }

    // 工具调用开始：content_block_start type=tool_use
    if (obj.type === 'content_block_start' && obj.content_block?.type === 'tool_use') {
      result.toolStart = {
        index: obj.index ?? 0,
        name: obj.content_block.name,
      }
    }

    // 工具输入 JSON 增量
    if (obj.type === 'content_block_delta' && obj.delta?.type === 'input_json_delta') {
      result.toolInputDelta = {
        index: obj.index ?? 0,
        json: obj.delta.partial_json ?? '',
      }
    }

    // 工具调用块结束
    if (obj.type === 'content_block_stop' && typeof obj.index === 'number') {
      result.toolEnd = { index: obj.index }
    }

    // result 事件提取 usage
    if (obj.type === 'result' && obj.usage) {
      result.usage = {
        inputTokens: obj.usage.input_tokens || 0,
        outputTokens: obj.usage.output_tokens || 0,
        cacheCreationInputTokens: obj.usage.cache_creation_input_tokens || 0,
        cacheReadInputTokens: obj.usage.cache_read_input_tokens || 0,
      }
    }

    return (result.text || result.sessionId || result.toolStart || result.toolInputDelta || result.toolEnd || result.usage) ? result : null
  } catch {
    return null
  }
}

/**
 * 解析 Gemini CLI stream-json 的单行输出
 * 格式：
 *   {"type":"init","session_id":"xxx","model":"auto-gemini-3"}
 *   {"type":"message","role":"assistant","content":"...","delta":true}
 *   {"type":"result","status":"success","stats":{...}}
 */
function parseGeminiStreamEvent(line: string): StreamEventResult | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try {
    const obj = JSON.parse(trimmed)
    const result: StreamEventResult = {}

    // init 事件提取 session_id
    if (obj.type === 'init' && obj.session_id) {
      result.sessionId = obj.session_id
    }

    // assistant 消息提取文本
    if (obj.type === 'message' && obj.role === 'assistant' && obj.content) {
      result.text = obj.content
    }

    return (result.text || result.sessionId) ? result : null
  } catch {
    return null
  }
}

/**
 * 解析 Codex CLI --json 的单行输出（JSONL 事件流）
 * 格式：
 *   {"type":"thread.started","thread_id":"xxx"}
 *   {"type":"turn.started"}
 *   {"type":"message.output_text.delta","delta":"text"}
 *   {"type":"message.output_text.done","text":"full text"}
 *   {"type":"turn.completed"}
 */
function parseCodexStreamEvent(line: string): StreamEventResult | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  try {
    const obj = JSON.parse(trimmed)
    const result: StreamEventResult = {}

    // thread.started 提取 thread_id 作为 sessionId
    if (obj.type === 'thread.started' && obj.thread_id) {
      result.sessionId = obj.thread_id
    }

    // 流式文本 delta
    if (obj.type === 'message.output_text.delta' && obj.delta) {
      result.text = obj.delta
    }

    return (result.text || result.sessionId) ? result : null
  } catch {
    return null
  }
}

export const claudeCode = new GenericAdapter({
  id: 'claude-code',
  name: 'Claude Code',
  icon: 'claude',
  command: 'claude',
  detectCommand: 'claude --version',
  defaultArgs: [],
  printModeArgs: ['-p'],
  continueArgs: ['-c'],
  skipConfirmArgs: ['--dangerously-skip-permissions'],
  resumeArgs: ['--resume'],
  outputFormatArgs: ['--output-format', 'stream-json', '--verbose'],
  inputFormatArgs: ['--input-format', 'stream-json'],
  useStreamJson: true,
  modelArgs: ['--model'],
  parseStreamEvent: parseClaudeStreamEvent,
})

export const geminiCli = new GenericAdapter({
  id: 'gemini-cli',
  name: 'Gemini CLI',
  icon: 'gemini',
  command: 'gemini',
  detectCommand: 'gemini --version',
  defaultArgs: [],
  printModeArgs: [],
  continueArgs: [],
  skipConfirmArgs: ['-y'],
  resumeArgs: ['-r'],
  modelArgs: ['-m'],
  outputFormatArgs: ['-o', 'stream-json'],
  useStreamJson: true,
  parseStreamEvent: parseGeminiStreamEvent,
})

export const codex = new GenericAdapter({
  id: 'codex',
  name: 'Codex',
  icon: 'codex',
  command: 'codex',
  detectCommand: 'codex --version',
  defaultArgs: ['exec'],
  printModeArgs: [],
  continueArgs: [],
  skipConfirmArgs: ['--full-auto', '--skip-git-repo-check'],
  resumeArgs: ['resume'],
  resumeBeforeMessage: true,
  modelArgs: ['-m'],
  imagePathArgs: ['-i'],
  outputFormatArgs: ['--json'],
  useStreamJson: true,
  parseStreamEvent: parseCodexStreamEvent,
})

export const qwenCode = new GenericAdapter({
  id: 'qwen-code',
  name: 'Qwen Code',
  icon: 'qwen',
  command: 'qwen-code',
  detectCommand: 'qwen-code --version',
  defaultArgs: [],
  printModeArgs: ['-p'],
  continueArgs: ['-c'],
  skipConfirmArgs: ['--yes'],
  modelArgs: ['--model'],
})

export const kimiCode = new GenericAdapter({
  id: 'kimi-code',
  name: 'Kimi Code',
  icon: 'kimi',
  command: 'kimi',
  detectCommand: 'kimi --version',
  defaultArgs: [],
  printModeArgs: ['-p'],
  continueArgs: ['-c'],
  skipConfirmArgs: ['--yes'],
  modelArgs: ['--model'],
})

export const copilot = new GenericAdapter({
  id: 'copilot',
  name: 'GitHub Copilot',
  icon: 'copilot',
  command: 'copilot',
  detectCommand: 'copilot --version',
  defaultArgs: [],
  printModeArgs: ['-p'],
  continueArgs: ['--continue'],
  skipConfirmArgs: ['--yolo'],
  resumeArgs: ['--resume'],
  modelArgs: ['--model'],
})

/** 所有已注册的适配器 */
export const allAdapters = [
  claudeCode,
  geminiCli,
  codex,
  qwenCode,
  kimiCode,
  copilot,
]
