import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useState } from 'react'

import { AdminQueryError } from '@/components/admin/admin-query-error'
import { DashboardShell } from '@/components/admin/dashboard-shell'
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
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Field, FieldLabel, FieldTitle } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { type Range, threadLabel } from '@/lib/admin-format'
import { ADMIN_SITES_QUERY_KEY, fetchAdminSites } from '@/lib/admin-sites'
import { describeApiError, readApiData } from '@/lib/api-response'
import { BusinessRouteError } from '@/lib/business-route-error'
import { setupStatusServerFn } from '@/lib/setup-status'

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    const { setupAvailable } = await setupStatusServerFn()
    if (setupAvailable) throw redirect({ to: '/create-admin-user' })
  },
  component: DashboardPage,
  errorComponent: BusinessRouteError,
})

// Client mirror of the server stats payload (dates already cross the wire as
// strings), mirroring the PageSummary copy in the moderation route.
type DashboardStats = {
  totals: {
    comments: number
    visible: number
    hidden: number
    deleted: number
    pages: number
    votesUp: number
    votesDown: number
    blockedUsers: number
  }
  window: { days: number; start: string; comments: number; votesUp: number; votesDown: number }
  series: { day: string; comments: number; visible: number; hidden: number; votesUp: number; votesDown: number }[]
  topPages: { pageId: string; title: string | null; canonicalUrl: string; total: number }[]
  moderationActions: { action: string; count: number }[]
}

function DashboardPage() {
  const [siteOverride, setSiteOverride] = useState<string | null>(null)
  const [days, setDays] = useState<Range>('30')

  // Site list comes from /api/moderation: it returns the sites the viewer is
  // a member of, unlike /api/admin/sites which lists every site.
  const sitesQuery = useQuery({
    queryKey: ADMIN_SITES_QUERY_KEY,
    queryFn: fetchAdminSites,
    retry: false,
  })
  const sites = sitesQuery.data?.sites ?? []

  const site =
    siteOverride !== null && sites.some((item) => item.key === siteOverride) ? siteOverride : (sites[0]?.key ?? '')

  const statsQuery = useQuery({
    queryKey: ['admin-stats', site, days],
    queryFn: async () => {
      const response = await fetch(`/api/admin/stats?site=${encodeURIComponent(site)}&days=${days}`)
      const data = await readApiData<{ stats: DashboardStats }>(response)
      return data.stats
    },
    enabled: site !== '',
    retry: false,
  })

  const failure = describeApiError(sitesQuery.error ?? statsQuery.error, 'Could not load dashboard data')

  const switchSite = (next: string) => {
    if (next && next !== site) setSiteOverride(next)
  }

  const range = Number(days) as 7 | 30 | 90

  return (
    <DashboardShell>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 text-foreground">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className="text-sm text-muted-foreground">Last Comments</p>
            <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            {sites.length > 0 && (
              <>
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="dashboard-site" className="text-muted-foreground">
                    Site
                  </FieldLabel>
                  <Select
                    items={sites.map((item) => ({ value: item.key, label: item.name }))}
                    value={site || null}
                    onValueChange={(value) => value && switchSite(value)}
                  >
                    <SelectTrigger id="dashboard-site" className="min-w-48">
                      <SelectValue placeholder="Select a site" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {sites.map((item) => (
                          <SelectItem key={item.id} value={item.key}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field orientation="horizontal">
                  <FieldTitle className="text-muted-foreground">Range</FieldTitle>
                  <RangeToggle days={days} onChange={setDays} />
                </Field>
              </>
            )}
          </div>
        </header>

        {sitesQuery.error || statsQuery.error ? (
          <AdminQueryError
            failure={failure}
            forbiddenTitle="The dashboard is restricted to administrators."
            onRetry={
              failure.forbidden
                ? undefined
                : () => {
                    // Retry whichever request failed, not just the site list.
                    if (sitesQuery.error) void sitesQuery.refetch()
                    if (statsQuery.error) void statsQuery.refetch()
                  }
            }
            onSignedIn={() => void sitesQuery.refetch()}
          />
        ) : sitesQuery.isPending ? (
          <p aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner data-icon="inline-start" />
            Loading dashboard…
          </p>
        ) : sites.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No sites yet</CardTitle>
              <CardDescription>Create your first site to start collecting comments.</CardDescription>
              <CardAction>
                <Button render={<Link to="/moderation" search={{ view: 'sites' }} />}>Go to Sites</Button>
              </CardAction>
            </CardHeader>
          </Card>
        ) : (
          <DashboardContent stats={statsQuery.data ?? null} loading={statsQuery.isFetching} days={range} site={site} />
        )}
      </main>
    </DashboardShell>
  )
}

type DashboardContentProps = {
  stats: DashboardStats | null
  loading: boolean
  days: 7 | 30 | 90
  site: string
}

function DashboardContent({ stats, loading, days, site }: DashboardContentProps) {
  if (!stats) return <SkeletonCards />

  const { totals, series, topPages, moderationActions } = stats

  return (
    <>
      <section aria-label="Summary" className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total comments"
          description="All comments ever posted"
          value={totals.comments.toLocaleString()}
          footnote={`+${stats.window.comments.toLocaleString()} in the last ${days} days`}
        />
        <StatCard
          title="Threads"
          description="Pages with a comment thread"
          value={totals.pages.toLocaleString()}
          footnote={`${totals.visible.toLocaleString()} visible comments`}
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
          footnote={`${totals.blockedUsers.toLocaleString()} blocked users`}
          action={
            <CardAction>
              <Button variant="outline" size="sm" render={<Link to="/moderation" search={{ view: 'recent' }} />}>
                Review
              </Button>
            </CardAction>
          }
        />
      </section>

      {loading && (
        <p aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner data-icon="inline-start" />
          Updating…
        </p>
      )}

      <section aria-label="Trends" className="grid gap-4 lg:grid-cols-3">
        <CommentActivityPanel
          className="lg:col-span-2"
          days={days}
          windowComments={stats.window.comments}
          series={series}
        />
        <CommentStatusPie
          totals={totals}
          emptyTitle="No comments yet"
          emptyDescription="Comments show up here as soon as a page with the embed posts them."
        />
      </section>

      <section aria-label="Breakdown" className="grid gap-4 lg:grid-cols-3">
        <VotesPanel days={days} votesUp={stats.window.votesUp} votesDown={stats.window.votesDown} series={series} />

        <Card>
          <CardHeader>
            <CardTitle>Top threads</CardTitle>
            <CardDescription>Most active threads, last {days} days</CardDescription>
          </CardHeader>
          <CardContent>
            <Leaderboard
              items={topPages.map((page) => ({
                key: page.pageId,
                label: threadLabel(page.title, page.canonicalUrl),
                value: page.total,
              }))}
              renderLabel={(item) => (
                <Link to="/moderation/$pageId" params={{ pageId: item.key }} search={{ site }}>
                  {item.label}
                </Link>
              )}
              ariaValueText={(item) => `${item.label}, ${item.value} comments`}
              empty={
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>No active threads</EmptyTitle>
                    <EmptyDescription>No thread received a comment in the last {days} days.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              }
            />
          </CardContent>
        </Card>

        <VisibleRatePanel totals={totals} />
      </section>

      <ModerationActivityCard days={days} moderationActions={moderationActions} scopeCopy="site" />
    </>
  )
}
