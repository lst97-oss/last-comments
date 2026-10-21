import { renderMarkdown } from '@lst97-oss/last-comments-widgets/client'
import { useEffect, useMemo, useRef } from 'react'
import { BlogMarkdownScope } from '@/components/blog/blog-widgets'
import { MermaidDiagram } from '@/components/blog/mermaid-diagram'
import { splitBlogSegments, withCodeBlockFrames } from '@/lib/blog/blog-render'
import { highlightCodeBlocks } from '@/lib/code-block'

export function BlogMarkdown({ markdown }: { markdown: string }) {
  const { segments, html } = useMemo(() => {
    const segments = splitBlogSegments(markdown)
    return {
      segments,
      html: segments.map((segment) =>
        segment.kind === 'mermaid' ? null : withCodeBlockFrames(renderMarkdown(segment.content)),
      ),
    }
  }, [markdown])
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const controller = new AbortController()
    void highlightCodeBlocks(root, controller.signal)
    return () => controller.abort()
  }, [markdown])

  return (
    <BlogMarkdownScope className="lc-markdown text-sm leading-relaxed">
      <div ref={rootRef} className="flex flex-col gap-4">
        {segments.map((segment, index) =>
          segment.kind === 'mermaid' ? (
            <MermaidDiagram key={`mermaid:${index}:${segment.content.length}`} chart={segment.content} />
          ) : (
            <div
              key={`markdown:${index}:${segment.content.length}`}
              className="lc-md"
              dangerouslySetInnerHTML={{ __html: html[index] ?? '' }}
            />
          ),
        )}
      </div>
    </BlogMarkdownScope>
  )
}
