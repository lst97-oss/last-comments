import { codeBlockMarkupFromHtml, normalizeCodeLanguage } from '@/lib/code-block'

export type BlogSegment = { kind: 'markdown'; content: string } | { kind: 'mermaid'; content: string }

const MERMAID_FENCE_RE = /^```mermaid[ \t]*\n([\s\S]*?)^```[ \t]*$/gim

const CODE_BLOCK_RE = /<pre><code class="language-([\w+#-]+)">([\s\S]*?)<\/code><\/pre>/g

export function splitBlogSegments(markdown: string): BlogSegment[] {
  const segments: BlogSegment[] = []
  let cursor = 0
  MERMAID_FENCE_RE.lastIndex = 0
  let match: RegExpExecArray | null = null
  while ((match = MERMAID_FENCE_RE.exec(markdown)) !== null) {
    const start = match.index ?? 0
    if (start > cursor) segments.push({ kind: 'markdown', content: markdown.slice(cursor, start) })
    segments.push({ kind: 'mermaid', content: (match[1] ?? '').trim() })
    cursor = start + match[0].length
  }
  if (cursor < markdown.length) segments.push({ kind: 'markdown', content: markdown.slice(cursor) })
  return segments.filter((segment) => segment.content.length > 0)
}

export function withCodeBlockFrames(html: string): string {
  return html.replace(CODE_BLOCK_RE, (_match, lang: string, source: string) => {
    const language = normalizeCodeLanguage(lang)
    // The markdown pipeline already escaped the source it rendered.
    return codeBlockMarkupFromHtml(language, source)
  })
}
