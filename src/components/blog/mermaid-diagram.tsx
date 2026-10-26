import { useTheme } from 'next-themes'
import { useEffect, useId, useRef, useState } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'

type DiagramStatus = { state: 'loading' } | { state: 'ready'; svg: string } | { state: 'error'; error: string }
// The render key (theme + chart) that produced a status. A status from another key is stale.
type DiagramResult = { renderKey: string; status: DiagramStatus }

const LOADING: DiagramStatus = { state: 'loading' }

// Client-only Mermaid renderer. `mermaid` touches `document` at import time,
// so it stays behind a dynamic import and never enters the SSR/RSC graph.
// Callers split ```mermaid fences out before the base markdown pipeline runs.
export function MermaidDiagram({ chart }: { chart: string }) {
  const rawId = useId()
  const { resolvedTheme } = useTheme()
  const renderKey = `${resolvedTheme}:${chart}`
  const [result, setResult] = useState<DiagramResult | null>(null)
  // Derived, not stored: a new chart or theme shows the loading state on this render, with no extra pass.
  const status = result?.renderKey === renderKey ? result.status : LOADING
  // Monotonic render generation: only the latest attempt may paint. Each
  // attempt also gets its own diagram id — mermaid requires ids to be unique
  // and overlapping same-id renders corrupt each other's DOM containers.
  const stateRef = useRef({ gen: 0 })

  useEffect(() => {
    const baseId = `lc-mermaid-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`
    const dark = resolvedTheme === 'dark'
    let cancelled = false

    async function render() {
      const gen = (stateRef.current.gen += 1)
      try {
        const { default: mermaid } = await import('mermaid')
        if (cancelled || gen !== stateRef.current.gen) return
        mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'default', securityLevel: 'strict' })
        const { svg: rendered } = await mermaid.render(`${baseId}-g${gen}`, chart)
        if (cancelled || gen !== stateRef.current.gen) return
        setResult({ renderKey, status: { state: 'ready', svg: rendered } })
      } catch (cause) {
        if (cancelled || gen !== stateRef.current.gen) return
        const error = cause instanceof Error ? cause.message : String(cause)
        setResult({ renderKey, status: { state: 'error', error } })
      }
    }

    void render()
    return () => {
      cancelled = true
    }
  }, [chart, renderKey, rawId, resolvedTheme])

  if (status.state === 'error') {
    return (
      <figure className="lc-mermaid-error flex flex-col gap-2 rounded-xl border border-error/40 bg-error-muted/40 p-4 text-sm">
        <figcaption className="font-medium text-error">Diagram failed to render</figcaption>
        <pre className="overflow-x-auto text-xs text-muted-foreground">
          <code>{chart}</code>
        </pre>
      </figure>
    )
  }

  if (status.state === 'loading') {
    // The chart source stays in a screen-reader-only block so no-JS readers
    // and crawlers keep the content.
    return (
      <figure
        className="lc-mermaid-loading flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
        role="status"
        aria-busy="true"
        aria-label="Loading diagram"
      >
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" aria-hidden />
          Rendering diagram…
        </span>
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <pre className="sr-only">
          <code>{chart}</code>
        </pre>
      </figure>
    )
  }

  return (
    <figure
      className="lc-mermaid overflow-x-auto rounded-xl border border-border bg-card p-4"
      role="img"
      aria-label="Architecture diagram"
      dangerouslySetInnerHTML={{ __html: status.svg }}
    />
  )
}
