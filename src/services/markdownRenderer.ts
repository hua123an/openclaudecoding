import { Marked } from 'marked'
import hljs from 'highlight.js'
import { stripAnsi } from './ansiRenderer'

/** 完整渲染器：带代码高亮（用于最终渲染） */
const marked = new Marked({
  breaks: true,
  gfm: true,
})

marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const language = lang && hljs.getLanguage(lang) ? lang : undefined
      let highlighted: string

      if (language) {
        highlighted = hljs.highlight(text, { language }).value
      } else {
        highlighted = text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
      }

      const langLabel = language || ''
      return `<div class="code-block">`
        + `<div class="code-block__header"><span class="code-block__lang">${langLabel}</span></div>`
        + `<pre class="code-block__pre"><code class="hljs">${highlighted}</code></pre>`
        + `</div>`
    },
  },
})

/** 轻量渲染器：跳过代码高亮（用于流式期间，避免阻塞） */
const markedFast = new Marked({
  breaks: true,
  gfm: true,
})

markedFast.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      const langLabel = lang || ''
      return `<div class="code-block">`
        + `<div class="code-block__header"><span class="code-block__lang">${langLabel}</span></div>`
        + `<pre class="code-block__pre"><code>${escaped}</code></pre>`
        + `</div>`
    },
  },
})

/**
 * 完整 Markdown 渲染（含代码高亮）
 * 用于消息完成后的最终渲染
 */
export function renderMarkdown(raw: string): string {
  const cleaned = stripAnsi(raw)
  try {
    const result = marked.parse(cleaned)
    if (typeof result !== 'string') {
      return `<pre>${cleaned}</pre>`
    }
    return result
  } catch {
    return `<pre>${cleaned}</pre>`
  }
}

/**
 * 轻量 Markdown 渲染（无代码高亮）
 * 用于流式输出期间，大幅减少渲染耗时
 */
export function renderMarkdownFast(raw: string): string {
  const cleaned = stripAnsi(raw)
  try {
    const result = markedFast.parse(cleaned)
    if (typeof result !== 'string') {
      return `<pre>${cleaned}</pre>`
    }
    return result
  } catch {
    return `<pre>${cleaned}</pre>`
  }
}
