import '@lst97-oss/last-comments-widgets/react/styles.css'

import { useMutation, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Copy, ExternalLink, Lock, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import { AdminQueryError } from '@/components/admin/admin-query-error'
import { DashboardShell } from '@/components/admin/dashboard-shell'
import { Hint } from '@/components/admin/hint'
import { Leaderboard } from '@/components/admin/leaderboard'
import { RangeToggle } from '@/components/admin/range-toggle'
import {
  CommentActivityPanel,
  CommentStatusPie,
  ModerationActivityCard,
  SkeletonCards,
  StatCard,
  VisibleRatePanel,
  VotesPanel,
} from '@/components/admin/stats-panels'
import { ThreadKeyBadge, ThreadStatusBadge } from '@/components/admin/thread-status-badge'
import { ThreadCommentsSection, ThreadMetaCard } from '@/components/admin/thread-widgets'
import { Alert, AlertTitle } from '@/components/ui/alert'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { type Range } from '@/lib/admin-format'
import { describeApiError, readApiData } from '@/lib/api-response'
import { useSessionPrincipal } from '@/lib/business-auth-client'
import { BusinessRouteError } from '@/lib/business-route-error'
import { copyText } from '@/lib/clipboard'
import { embedSnippet, type PageSummary } from '@/lib/page-thread'
import { setupStatusServerFn } from '@/lib/setup-status'

// The thread of one page: the moderation dashboard's detail view. The
// underscore keeps this a sibling of /moderation instead of a child of it,
// so the page list and this view never render together.
export const Route = createFileRoute('/moderation_/$pageId')({
  validateSearch: (search: Record<string, unknown>) => ({
    site: typeof search.site === 'string' ? search.site : '',
  }),
  beforeLoad: async () => {
    const { setupAvailable } = await setupStatusServerFn()
    if (setupAvailable) throw redirect({ to: '/create-admin-user' })
  },
  component: PageThreadPage,
  errorComponent: BusinessRouteError,
})

// Client mirror of the server payload (dates cross the wire as strings).
type ThreadStats = {
  totals: {
    comments: number
    visible: number
    hidden: number
    deleted: number
    votesUp: number
    votesDown: number
    replies: number
    pinned: number
    participants: number
  }
  window: { days: number; start: string; comments: number; votesUp: number; votesDown: number }
  series: { day: string; comments: number; visible: number; hidden: number; votesUp: number; votesDown: number }[]
  topAuthors: { authorName: string; total: number }[]
  moderationActions: { action: string; count: number }[]
  firstAt: string | null
}

type PageThread = {
  siteName: string
  page: PageSummary
  stats: ThreadStats
}

function PageThreadPage() {
  const { site } = Route.useSearch()
  const { pageId } = Route.useParams()
  const [days, setDays] = useState<Range>('30')
  const [actionError, setActionError] = useState('')
  const { principal } = useSessionPrincipal()
  // Same-origin dashboard: the widget calls /api/moderation and needs no
  // absolute origin on the server, so an empty baseUrl keeps SSR inert.
  const baseUrl = typeof window === 'undefined' ? '' : window.location.origin

  const threadQuery = useQuery({
    queryKey: ['page-thread', site, pageId, days],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/pages/${encodeURIComponent(pageId)}?site=${encodeURIComponent(site)}&days=${days}`,
      )
      return readApiData<PageThread>(response)
    },
    enabled: site !== '',
    retry: false,
  })
  const thread = threadQuery.data ?? null
  const failure = describeApiError(threadQuery.error, 'Could not load this thread')
  // A thread link always carries its site; without one there is nothing to read.
  const missingSite = site === ''
  const error = missingSite ? 'This thread link is missing its site.' : failure.message
  const hasError = missingSite || Boolean(threadQuery.error)

  // Locking is a page-level moderation action; the thread stays open.
  const lockMutation = useMutation({
    mutationFn: async (locked: boolean) => {
      const response = await fetch('/api/moderation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ site, target: 'page', pageId, locked }),
      })
      await readApiData<Record<string, unknown>>(response)
    },
    onSuccess: async () => {
      setActionError('')
      await threadQuery.refetch()
    },
    onError: (cause) => setActionError(cause instanceof Error ? cause.message : 'Could not update the thread'),
  })

  const page = thread?.page
  const title = page ? (page.title ?? page.canonicalUrl) : 'Thread'

  return (
    <DashboardShell>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 text-foreground">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link to="/moderation" search={{ view: 'pages' }} />}>Pages</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="max-w-80 truncate">{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{thread ? `${thread.siteName} · Thread` : 'Thread'}</p>
            <h1 className="truncate text-3xl font-semibold tracking-tight">{title}</h1>
            {page && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <a className="max-w-80 truncate underline" href={page.canonicalUrl} target="_blank" rel="noreferrer">
                  {page.canonicalUrl}
                </a>
                <ThreadStatusBadge isLocked={page.isLocked} />
                <ThreadKeyBadge pageKey={page.pageKey} />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RangeToggle days={days} onChange={setDays} />
            {page && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={lockMutation.isPending}
                  onClick={() => void lockMutation.mutateAsync(!page.isLocked).catch(() => undefined)}
                >
                  {lockMutation.isPending ? <Spinner data-icon="inline-start" /> : <Lock data-icon="inline-start" />}
                  {page.isLocked ? 'Unlock' : 'Lock'}
                </Button>
                <Hint label="Copy embed config for this thread">
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
                <Hint label="Open the page this thread belongs to">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Open the page"
                    render={
                      <a href={page.canonicalUrl} target="_blank" rel="noreferrer">
                        <ExternalLink />
                      </a>
                    }
                  />
                </Hint>
              </>
            )}
          </div>
        </header>

        {actionError ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>{actionError}</AlertTitle>
          </Alert>
        ) : null}

        {hasError ? (
          <AdminQueryError
            failure={failure}
            title={error}
            onRetry={() => void threadQuery.refetch()}
            onSignedIn={() => void threadQuery.refetch()}
            extraAction={
              <Button variant="ghost" render={<Link to="/moderation" search={{ view: 'pages' }} />}>
                Back to Pages
              </Button>
            }
          />
        ) : null}

        {threadQuery.isFetching && thread ? (
          <p aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner data-icon="inline-start" />
            Updating…
          </p>
        ) : null}

        {thread ? (
          <ThreadContent
            thread={thread}
            baseUrl={baseUrl}
            site={site}
            pageId={pageId}
            viewerUserId={principal?.userId}
            onModerated={() => void threadQuery.refetch()}
          />
        ) : threadQuery.isPending ? (
          <SkeletonCards />
        ) : null}
      </main>
    </DashboardShell>
  )
}

type ThreadContentProps = {
  thread: PageThread
  baseUrl: string
  site: string
  pageId: string
  viewerUserId: string | undefined
  onModerated: () => void
}

function ThreadContent({ thread, baseUrl, site, pageId, viewerUserId, onModerated }: ThreadContentProps) {
  const { page, stats } = thread
  const { totals, window: windowStats, series, topAuthors, moderationActions } = stats

  return (
    <>
      <section aria-label="Summary" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total comments"
          description="All comments on this thread"
          value={totals.comments.toLocaleString()}
          footnote={`+${windowStats.comments.toLocaleString()} in the last ${windowStats.days} days`}
        />
        <StatCard
          title="Participants"
          description="Distinct commenters"
          value={totals.participants.toLocaleString()}
          footnote={`${totals.replies.toLocaleString()} replies · ${totals.pinned.toLocaleString()} pinned`}
        />
        <StatCard
          title="Net votes"
          description="Upvotes minus downvotes"
          value={(totals.votesUp - totals.votesDown).toLocaleString()}
          footnote={`${totals.votesUp.toLocaleString()} up · ${totals.votesDown.toLocaleString()} down`}
        />
        <StatCard
          title="Awaiting review"
          description="Hidden comments need a decision"
          value={totals.hidden.toLocaleString()}
          footnote={`${totals.deleted.toLocaleString()} deleted`}
        />
      </section>

      <section aria-label="Trends" className="grid gap-4 lg:grid-cols-3">
        <CommentActivityPanel
          className="lg:col-span-2"
          days={windowStats.days}
          windowComments={windowStats.comments}
          series={series}
        />
        <CommentStatusPie
          totals={totals}
          emptyTitle="No comments yet"
          emptyDescription="This thread has no comments to show."
        />
      </section>

      <section aria-label="Breakdown" className="grid gap-4 lg:grid-cols-3">
        <VotesPanel
          days={windowStats.days}
          votesUp={windowStats.votesUp}
          votesDown={windowStats.votesDown}
          series={series}
        />

        <Card>
          <CardHeader>
            <CardTitle>Top authors</CardTitle>
            <CardDescription>Most comments, last {windowStats.days} days</CardDescription>
          </CardHeader>
          <CardContent>
            <Leaderboard
              items={topAuthors.map((author, index) => ({
                // The server groups by name, so same-name commenters collide;
                // the index keeps the rows distinct.
                key: `${author.authorName}-${index}`,
                label: author.authorName,
                value: author.total,
              }))}
              ariaValueText={(item) => `${item.label}, ${item.value} comments`}
              empty={
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>No active authors</EmptyTitle>
                    <EmptyDescription>No one commented in the last {windowStats.days} days.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              }
            />
          </CardContent>
        </Card>

        <VisibleRatePanel totals={totals} />
      </section>

      <section aria-label="Thread" className="grid gap-4 lg:grid-cols-2">
        <ThreadMetaCard page={page} firstAt={stats.firstAt} site={site} />
        <ModerationActivityCard days={windowStats.days} moderationActions={moderationActions} scopeCopy="thread" />
      </section>

      <ThreadCommentsSection
        baseUrl={baseUrl}
        site={site}
        pageId={pageId}
        pageUrl={page.canonicalUrl}
        viewerUserId={viewerUserId}
        onModerated={onModerated}
      />
    </>
  )
}
