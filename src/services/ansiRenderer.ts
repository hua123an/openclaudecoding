import { AnsiUp } from 'ansi_up'

const ansi = new AnsiUp()
ansi.use_classes = true

/** 剥离非颜色/格式的控制序列（光标移动、清屏等） */
function stripControlSequences(raw: string): string {
  return raw
    // 光标移动/定位
    .replace(/\x1b\[\d*[ABCDHJ]/g, '')
    // 光标显示/隐藏
    .replace(/\x1b\[\?(?:25|12)[hl]/g, '')
    // 窗口标题设置
    .replace(/\x1b\][^\x07]*\x07/g, '')
    // OSC sequences
    .replace(/\x1b\][\d;]*[^\x1b]*(?:\x1b\\|\x07)/g, '')
    // 其他 CSI（保留 SGR m）
    .replace(/\x1b\[\d*[^m\d;]/g, '')
    // 回车 + 换行处理
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

/** ANSI 转 HTML（安全渲染） */
export function ansiToHtml(raw: string): string {
  const cleaned = stripControlSequences(raw)
  return ansi.ansi_to_html(cleaned)
}

/** 去除所有 ANSI 转义码，返回纯文本 */
export function stripAnsi(raw: string): string {
  return raw
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\x1b\][\d;]*[^\x1b]*(?:\x1b\\|\x07)/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}
