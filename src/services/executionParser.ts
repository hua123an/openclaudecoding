import type { ExecutionItem, ExecutionType } from '../types'

interface ParseRule {
  type: ExecutionType
  pattern: RegExp
  extract: (match: RegExpMatchArray) => { label: string; detail?: string }
}

/** Claude Code 解析规则 */
const claudeCodeRules: ParseRule[] = [
  { type: 'file_read', pattern: /Read\s+(\S+)/g, extract: (m) => ({ label: m[1] }) },
  { type: 'file_write', pattern: /(?:Write|Wrote)\s+(\S+)/g, extract: (m) => ({ label: m[1] }) },
  { type: 'file_edit', pattern: /Edit\s+(\S+)/g, extract: (m) => ({ label: m[1] }) },
  { type: 'tool_use', pattern: /⏺\s+(\w+)/g, extract: (m) => ({ label: m[1] }) },
  { type: 'command_run', pattern: /(?:Running|Executing|❯)\s*(.+?)$/gm, extract: (m) => ({ label: m[1].trim() }) },
]

/** Gemini CLI 解析规则 */
const geminiCliRules: ParseRule[] = [
  { type: 'file_read', pattern: /Reading\s+file:\s*(\S+)/g, extract: (m) => ({ label: m[1] }) },
  { type: 'file_write', pattern: /Writing\s+to:\s*(\S+)/g, extract: (m) => ({ label: m[1] }) },
  { type: 'tool_use', pattern: /Using\s+tool:\s*(\w+)/g, extract: (m) => ({ label: m[1] }) },
  { type: 'command_run', pattern: /\$\s+(.+?)$/gm, extract: (m) => ({ label: m[1].trim() }) },
]

/** 通用回退规则 */
const genericRules: ParseRule[] = [
  { type: 'command_run', pattern: /\$\s+(.+?)$/gm, extract: (m) => ({ label: m[1].trim() }) },
]

const rulesByTool: Record<string, ParseRule[]> = {
  'claude-code': claudeCodeRules,
  'gemini-cli': geminiCliRules,
}

/** 从文本中解析执行操作 */
export function parseExecutions(text: string, toolId: string): ExecutionItem[] {
  const rules = rulesByTool[toolId] || genericRules
  const items: ExecutionItem[] = []

  for (const rule of rules) {
    // 重置 lastIndex（全局正则）
    rule.pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = rule.pattern.exec(text)) !== null) {
      const { label, detail } = rule.extract(match)
      items.push({
        id: `exec_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        type: rule.type,
        label,
        detail,
        timestamp: Date.now(),
        status: 'success',
      })
    }
  }

  return items
}
