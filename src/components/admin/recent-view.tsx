'use client'

import { Link } from '@tanstack/react-router'
import { Eye, EyeOff, Pin, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Pager } from '@/components/admin/pages-view'
import { ThreadStatusBadge } from '@/components/admin/thread-status-badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item'
import { Spinner } from '@/components/ui/spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { authorInitials, timeAgo } from '@/lib/admin-format'
import { PAGE_LIST_LIMIT, type PageSummary } from '@/lib/page-thread'

// The recent window of the Recent tab. 0 is "all time": the window is
// unbounded, so every comment of every thread counts.
const RECENT_WINDOWS = [0, 1, 7, 30] as const

const TAKEDOWN_PAGE_SIZE = 10

function windowOptionLabel(days: number) {
  if (days === 0) return 'ALL'
  return days === 1 ? '24H' : `${days}D`
}

function RecentStatusBadge({ status }: { status: 'visible' | 'hidden' | 'deleted' }) {
  if (status === 'hidden') return <Badge variant="destructive">Hidden</Badge>
  if (status === 'deleted') return <Badge variant="outline">Deleted</Badge>
  return null
}

export function threadPreviewExcerpt(bodyMarkdown: string, max = 40): string {
  const flat = bodyMarkdown.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

export function RecentView({
  pages,
  site,
  recentDays,
  onRecentDays,
  onAct,
}: {
  pages: PageSummary[]
  site: string
  recentDays: number
  onRecentDays: (days: number) => void
  onAct: (action: Record<string, string | boolean>) => Promise<void>
}) {
  // The takedown list is client-paged: the rows come from the pages the
  // server already summarized, so a busy site stays one screenful.
  const [takedownPage, setTakedownPage] = useState(0)
  // The comment being restored, so only that row shows the loading state.
  const [restoringId, setRestoringId] = useState<string | null>(null)
  if (pages.length === 0) {
    return (
      <Card>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Pin />
              </EmptyMedia>
              <EmptyTitle>No comments to review</EmptyTitle>
              <EmptyDescription>Comments appear here as soon as a page with the embed posts them.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    )
  }
  const windowLabel =
    recentDays === 0 ? 'all time' : recentDays === 1 ? 'the last 24 hours' : `the last ${recentDays} days`
  const windowShortLabel = recentDays === 0 ? 'all time' : recentDays === 1 ? 'the last 24h' : `the last ${recentDays}d`
  const takedowns = pages
    .flatMap((page) =>
      page.recent.preview.map((comment) => ({
        key: `${comment.id}-${page.id}`,
        comment,
        threadTitle: page.title ?? page.canonicalUrl,
        pageId: page.id,
      })),
    )
    .filter((row) => row.comment.status !== 'visible')
    .sort((a, b) => +new Date(b.comment.createdAt) - +new Date(a.comment.createdAt))
  const takedownLastPage = Math.max(0, Math.ceil(takedowns.length / TAKEDOWN_PAGE_SIZE) - 1)
  const takedownCurrent = Math.min(takedownPage, takedownLastPage)
  const shownTakedowns = takedowns.slice(
    takedownCurrent * TAKEDOWN_PAGE_SIZE,
    takedownCurrent * TAKEDOWN_PAGE_SIZE + TAKEDOWN_PAGE_SIZE,
  )

  // Restore puts the comment back on the thread; the page list refetches
  // afterwards, so the row leaves this list on its own.
  async function restore(commentId: string) {
    setRestoringId(commentId)
    try {
      await onAct({ target: 'comment', commentId, action: 'restore' })
    } finally {
      setRestoringId(null)
    }
  }
  return (
    <>
      <section aria-label="Recent threads" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {pages.length} {pages.length === 1 ? 'thread' : 'threads'} · updates in {windowLabel}
          </p>
          <ToggleGroup
            aria-label="Recent window"
            value={[String(recentDays)]}
            onValueChange={(next) => {
              const picked = Number(next[0])
              if (RECENT_WINDOWS.includes(picked as (typeof RECENT_WINDOWS)[number])) onRecentDays(picked)
            }}
          >
            {RECENT_WINDOWS.map((option) => (
              <ToggleGroupItem key={option} value={String(option)} variant="outline" size="sm">
                {windowOptionLabel(option)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        {pages.map((page) => {
          const { latest, recent } = page
          const authorNames = recent.authors.map((author) => author.authorName)
          const extraAuthors = Math.max(0, recent.totalAuthors - authorNames.length)
          return (
            <Card key={page.id}>
              <CardContent className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <h2 className="truncate font-medium">{page.title ?? page.canonicalUrl}</h2>
                    <a
                      className="truncate text-sm text-muted-foreground underline"
                      href={page.canonicalUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {page.canonicalUrl}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ThreadStatusBadge isLocked={page.isLocked} />
                    {page.latestAt ? (
                      <time dateTime={page.latestAt} title={new Date(page.latestAt).toLocaleString()}>
                        {timeAgo(page.latestAt)}
                      </time>
                    ) : (
                      <span>No comments yet</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {recent.count > 0 ? (
                    <Badge variant="secondary">
                      +{recent.count} in {windowShortLabel}
                    </Badge>
                  ) : (
                    <Badge variant="outline">No updates in {windowShortLabel}</Badge>
                  )}
                  {authorNames.length > 0 && (
                    <>
                      <AvatarGroup data-size="sm">
                        {authorNames.slice(0, 3).map((name) => {
                          const updates = recent.authors.find((author) => author.authorName === name)?.count ?? 0
                          return (
                            <Avatar key={name} size="sm" title={`${name} · ${updates} updates`}>
                              <AvatarFallback>{authorInitials(name)}</AvatarFallback>
                            </Avatar>
                          )
                        })}
                        {extraAuthors > 0 && <AvatarGroupCount>+{extraAuthors}</AvatarGroupCount>}
                      </AvatarGroup>
                      <span className="text-xs text-muted-foreground">
                        {authorNames.slice(0, 3).join(', ')}
                        {extraAuthors > 0 && ` +${extraAuthors} more`}
                      </span>
                    </>
                  )}
                </div>
                {recent.count > 0 ? (
                  <Accordion>
                    <AccordionItem value={page.id}>
                      <AccordionTrigger>
                        Show {recent.preview.length} of {recent.count} recent{' '}
                        {recent.count === 1 ? 'update' : 'updates'}
                      </AccordionTrigger>
                      <AccordionContent>
                        <ItemGroup>
                          {recent.preview.map((comment) => (
                            <Item key={comment.id} variant="outline" size="sm">
                              <ItemMedia variant="icon">
                                <Avatar size="sm" title={comment.authorName}>
                                  <AvatarFallback>{authorInitials(comment.authorName)}</AvatarFallback>
                                </Avatar>
                              </ItemMedia>
                              <ItemContent>
                                <ItemTitle>
                                  {comment.authorName}
                                  <time
                                    dateTime={comment.createdAt}
                                    className="font-normal text-muted-foreground"
                                    title={new Date(comment.createdAt).toLocaleString()}
                                  >
                                    · {timeAgo(comment.createdAt)}
                                  </time>
                                </ItemTitle>
                                <ItemDescription>{threadPreviewExcerpt(comment.bodyMarkdown, 140)}</ItemDescription>
                              </ItemContent>
                              <ItemActions>
                                <RecentStatusBadge status={comment.status} />
                              </ItemActions>
                            </Item>
                          ))}
                        </ItemGroup>
                        {recent.count > recent.preview.length && (
                          <p className="pt-2 text-xs text-muted-foreground">
                            Showing {recent.preview.length} of {recent.count} updates — open the thread for the full
                            list.
                          </p>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ) : (
                  latest && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{latest.authorName}</span>{' '}
                      <time dateTime={latest.createdAt} title={new Date(latest.createdAt).toLocaleString()}>
                        {timeAgo(latest.createdAt)}
                      </time>{' '}
                      {threadPreviewExcerpt(latest.bodyMarkdown)}
                    </p>
                  )
                )}
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    {page.total} total · {page.visible} visible
                    {page.hidden > 0 && <span className="text-destructive"> · {page.hidden} hidden</span>}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    render={<Link to="/moderation/$pageId" params={{ pageId: page.id }} search={{ site }} />}
                  >
                    View comments
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
        {pages.length >= PAGE_LIST_LIMIT && (
          <p className="text-xs text-muted-foreground">
            Only the {PAGE_LIST_LIMIT} most recently active pages are listed.
          </p>
        )}
      </section>
      <section aria-label="Recently hidden and removed">
        <Card>
          <CardHeader>
            <CardTitle>Hidden &amp; removed</CardTitle>
            <CardDescription>
              {takedowns.length === 0
                ? `Nothing was hidden or removed in ${windowLabel}.`
                : `${takedowns.length} ${takedowns.length === 1 ? 'comment' : 'comments'} taken down in ${windowLabel}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {takedowns.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <EyeOff />
                  </EmptyMedia>
                  <EmptyTitle>Nothing taken down</EmptyTitle>
                  <EmptyDescription>
                    Hidden and deleted comments from {windowLabel} appear here for review.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  {shownTakedowns.map((row) => (
                    <div
                      key={row.key}
                      className="flex flex-col gap-2 rounded-md border-l-2 border-l-destructive bg-muted/50 p-3 sm:flex-row sm:items-center sm:gap-3"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        {row.comment.status === 'hidden' ? (
                          <EyeOff className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Hidden" />
                        ) : (
                          <Trash2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Deleted" />
                        )}
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <p className="text-sm">
                            <span className="font-medium">{row.comment.authorName}</span>{' '}
                            <span className="text-muted-foreground">
                              on{' '}
                              <Link
                                to="/moderation/$pageId"
                                params={{ pageId: row.pageId }}
                                search={{ site }}
                                className="underline"
                              >
                                {row.threadTitle}
                              </Link>
                            </span>{' '}
                            <time
                              dateTime={row.comment.createdAt}
                              className="text-xs text-muted-foreground"
                              title={new Date(row.comment.createdAt).toLocaleString()}
                            >
                              {timeAgo(row.comment.createdAt)}
                            </time>
                          </p>
                          <p className="truncate text-sm text-muted-foreground">
                            {threadPreviewExcerpt(row.comment.bodyMarkdown, 140)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 sm:justify-end">
                        {row.comment.status === 'hidden' ? (
                          <Badge variant="destructive">Hidden</Badge>
                        ) : (
                          <Badge variant="outline">Deleted</Badge>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={restoringId !== null}
                          onClick={() => void restore(row.comment.id)}
                        >
                          {restoringId === row.comment.id ? <Spinner data-icon="inline-start" /> : <Eye aria-hidden />}
                          Restore
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Pager
                  total={takedowns.length}
                  page={takedownCurrent}
                  size={TAKEDOWN_PAGE_SIZE}
                  onPage={setTakedownPage}
                />
                <p className="text-xs text-muted-foreground">
                  Restoring puts the comment back on its thread. Only the most recent comments of each thread are listed
                  — open the thread for its full history.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  )
}
