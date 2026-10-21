'use client'

import { Link } from '@tanstack/react-router'
import { EyeOff, Pin, Trash2 } from 'lucide-react'

import { ThreadStatusBadge } from '@/components/admin/thread-status-badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { authorInitials, timeAgo } from '@/lib/admin-format'
import { PAGE_LIST_LIMIT, type PageSummary } from '@/lib/page-thread'

const RECENT_WINDOWS = [1, 7, 30] as const

const TAKEDOWN_LIST_SIZE = 20

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
}: {
  pages: PageSummary[]
  site: string
  recentDays: number
  onRecentDays: (days: number) => void
}) {
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
  const windowLabel = recentDays === 1 ? 'last 24 hours' : `last ${recentDays} days`
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
  const shownTakedowns = takedowns.slice(0, TAKEDOWN_LIST_SIZE)
  return (
    <>
      <section aria-label="Recent threads" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {pages.length} {pages.length === 1 ? 'thread' : 'threads'} · updates in the {windowLabel}
          </p>
          <ToggleGroup
            aria-label="Recent window"
            value={[String(recentDays)]}
            onValueChange={(next) => {
              const picked = Number(next[0])
              if (picked === 1 || picked === 7 || picked === 30) onRecentDays(picked)
            }}
          >
            {RECENT_WINDOWS.map((option) => (
              <ToggleGroupItem key={option} value={String(option)} variant="outline" size="sm">
                {option === 1 ? '24H' : `${option}D`}
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
                      +{recent.count} in the {recentDays === 1 ? 'last 24h' : `last ${recentDays}d`}
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      No updates in the {recentDays === 1 ? 'last 24h' : `last ${recentDays}d`}
                    </Badge>
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
                ? `Nothing was hidden or removed in the ${windowLabel}.`
                : `${takedowns.length} ${takedowns.length === 1 ? 'comment' : 'comments'} taken down in the ${windowLabel}`}
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
                    Hidden and deleted comments from the {windowLabel} appear here for review.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col gap-2">
                {shownTakedowns.map((row) => (
                  <div
                    key={row.key}
                    className="flex flex-wrap items-center gap-3 rounded-md border-l-2 border-l-destructive bg-muted/50 p-3"
                  >
                    {row.comment.status === 'hidden' ? (
                      <EyeOff className="size-4 shrink-0 text-destructive" aria-label="Hidden" />
                    ) : (
                      <Trash2 className="size-4 shrink-0 text-muted-foreground" aria-label="Deleted" />
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
                    {row.comment.status === 'hidden' ? (
                      <Badge variant="destructive">Hidden</Badge>
                    ) : (
                      <Badge variant="outline">Deleted</Badge>
                    )}
                  </div>
                ))}
                {takedowns.length > shownTakedowns.length && (
                  <p className="pt-1 text-xs text-muted-foreground">
                    Showing {shownTakedowns.length} of {takedowns.length} takedowns — open the threads for the full
                    list.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  )
}
