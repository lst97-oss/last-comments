'use client'

import { Comments } from '@lst97-oss/last-comments-widgets/react'
import { Copy, Hash } from 'lucide-react'

import { Hint } from '@/components/admin/hint'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useWidgetTheme } from '@/hooks/use-widget-theme'
import { copyText } from '@/lib/clipboard'
import { embedSnippet, type PageSummary } from '@/lib/page-thread'

function formatTimestamp(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

export function ThreadMetaCard({ page, firstAt, site }: { page: PageSummary; firstAt: string | null; site: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Thread</CardTitle>
        <CardDescription>Where this thread lives and how to embed it</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)]">
          <dt className="text-muted-foreground">Page URL</dt>
          <dd className="min-w-0">
            <a className="block truncate underline" href={page.canonicalUrl} target="_blank" rel="noreferrer">
              {page.canonicalUrl}
            </a>
          </dd>
          <dt className="text-muted-foreground">Page key</dt>
          <dd className="min-w-0">
            {page.pageKey ? (
              <Badge variant="secondary">
                <Hash />
                {page.pageKey}
              </Badge>
            ) : (
              <span className="text-muted-foreground">URL only</span>
            )}
          </dd>
          <dt className="text-muted-foreground">Title</dt>
          <dd className="min-w-0 truncate">{page.title ?? '—'}</dd>
          <dt className="text-muted-foreground">First comment</dt>
          <dd className="min-w-0">{formatTimestamp(firstAt)}</dd>
          <dt className="text-muted-foreground">Latest activity</dt>
          <dd className="min-w-0">{formatTimestamp(page.latestAt)}</dd>
          <dt className="text-muted-foreground">Thread ID</dt>
          <dd className="flex min-w-0 items-center gap-1">
            <span className="truncate font-mono text-xs">{page.id}</span>
            <Hint label="Copy thread id">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Copy thread id"
                onClick={() => void copyText(page.id, 'Thread id copied')}
              >
                <Copy />
              </Button>
            </Hint>
          </dd>
        </dl>
        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted-foreground">Embed config</span>
          <div className="flex items-start gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs">
              {embedSnippet(site, page)}
            </code>
            <Hint label="Copy embed config">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Copy embed config"
                onClick={() => void copyText(embedSnippet(site, page), 'Embed config copied')}
              >
                <Copy />
              </Button>
            </Hint>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ThreadCommentsSection({
  baseUrl,
  site,
  pageId,
  pageUrl,
  viewerUserId,
  bodyLimit,
  onModerated,
}: {
  // The site's comment limit, so the composer counts what the server accepts.
  bodyLimit: number
  baseUrl: string
  site: string
  pageId: string
  pageUrl: string
  viewerUserId: string | undefined
  onModerated: () => void
}) {
  const theme = useWidgetTheme()
  return (
    <section aria-label="Comments" className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold tracking-tight">Comments</h2>
      <Comments
        key={pageId}
        baseUrl={baseUrl}
        pageId={pageId}
        pageUrl={pageUrl}
        site={site}
        theme={theme}
        viewerRole="admin"
        viewerUserId={viewerUserId}
        bodyLimit={bodyLimit}
        math
        mermaid
        onModerated={onModerated}
      />
    </section>
  )
}
