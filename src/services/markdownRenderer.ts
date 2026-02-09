import { Marked } from 'marked'
import hljs from 'highlight.js'
import { stripAnsi } from './ansiRenderer'

const marked = new Marked({
  breaks: true,
  gfm: true,
})

/** 自定义 renderer：代码块带语言标签 + 高亮 */
marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const language = lang && hljs.getLanguage(lang) ? lang : undefined
      let highlighted: string

      if (language) {
        highlighted = hljs.highlight(text, { language }).value
      } else {
        // 不用 highlightAuto（遍历所有语言极慢），直接 escape 输出
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

/**
 * 将 raw 内容（可能含 ANSI 码）转为 Markdown HTML
 * 用于 assistant 消息渲染
 */
export function renderMarkdown(raw: string): string {
  const cleaned = stripAnsi(raw)
  try {
    const result = marked.parse(cleaned)
    if (typeof result !== 'string') {
      console.error('[renderMarkdown] parse returned non-string:', typeof result, result)
      return `<pre>${cleaned}</pre>`
    }
    return result
  } catch (err) {
    console.error('[renderMarkdown] parse error:', err)
    return `<pre>${cleaned}</pre>`
  }
}
