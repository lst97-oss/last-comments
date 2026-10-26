'use client'

import { Link } from '@tanstack/react-router'
import { Copy, EllipsisVertical, Link2, Lock, LockOpen, Trash } from 'lucide-react'
import { useState, useTransition } from 'react'

import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog'
import { Hint } from '@/components/admin/hint'
import { PageCreateDialog } from '@/components/admin/page-create-dialog'
import { ThreadKeyBadge, ThreadStatusBadge } from '@/components/admin/thread-status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { type Site } from '@/lib/admin-sites'
import { copyText } from '@/lib/clipboard'
import { embedSnippet, PAGE_LIST_LIMIT, type PageSummary } from '@/lib/page-thread'

const PAGE_LIST_SIZE = 10

export function PagesView({
  sites,
  site,
  pages,
  onLockPage,
  onRefreshPages,
  onDeletePage,
}: {
  sites: Site[]
  site: string
  pages: PageSummary[]
  onLockPage: (page: PageSummary, locked: boolean) => void
  onRefreshPages: () => void
  onDeletePage: (page: PageSummary) => Promise<boolean>
}) {
  const selected = sites.find((item) => item.key === site)
  const [createOpen, setCreateOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [listPage, setListPage] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<PageSummary | null>(null)
  const [deleting, startDelete] = useTransition()

  function confirmDelete() {
    if (!deleteTarget) return
    // The transition keeps `deleting` true until the delete settles; the handler resolves to a boolean and never rejects.
    startDelete(async () => {
      if (await onDeletePage(deleteTarget)) setDeleteTarget(null)
    })
  }

  // The list is client-paged over the rows the server already caps at
  // PAGE_LIST_LIMIT, so a site with many threads stays one screenful.
  const needle = query.trim().toLowerCase()
  const matches = needle
    ? pages.filter((page) =>
        [page.title, page.canonicalUrl, page.pageKey].some((value) => value?.toLowerCase().includes(needle)),
      )
    : pages
  const listLastPage = Math.max(0, Math.ceil(matches.length / PAGE_LIST_SIZE) - 1)
  const listCurrent = Math.min(listPage, listLastPage)
  const visible = matches.slice(listCurrent * PAGE_LIST_SIZE, listCurrent * PAGE_LIST_SIZE + PAGE_LIST_SIZE)

  function search(value: string) {
    setQuery(value)
    setListPage(0)
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Pages</CardTitle>
          <CardDescription>
            {pages.length === 0
              ? 'Threads are created by the first comment on a page URL.'
              : `${pages.length} ${pages.length === 1 ? 'page' : 'pages'} · newest activity first`}
          </CardDescription>
          <CardAction>
            <Button type="button" data-tour="pages-create" onClick={() => setCreateOpen(true)}>
              New page
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {pages.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Link2 />
                </EmptyMedia>
                <EmptyTitle>No pages yet</EmptyTitle>
                <EmptyDescription>
                  Pages appear with the first comment: send <code>url</code> to thread by URL, or <code>url</code> and{' '}
                  <code>pageKey</code> to pin the thread to a stable key.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <Input
                type="search"
                value={query}
                onChange={(event) => search(event.target.value)}
                placeholder="Search title, URL or page key"
                aria-label="Search pages"
                className="max-w-sm"
              />
              {/* Cards below a 64rem container, and a five-column table from there up. Rows use display: contents
                  so every row shares the same column widths. */}
              {visible.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pages match “{query.trim()}”.</p>
              ) : (
                <div className="@container/pages">
                  <div className="flex flex-col @5xl/pages:grid @5xl/pages:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto] @5xl/pages:gap-x-6">
                    <span className="hidden pb-2 text-xs font-medium text-muted-foreground @5xl/pages:block">Page</span>
                    <span className="hidden pb-2 text-xs font-medium text-muted-foreground @5xl/pages:block">
                      Thread
                    </span>
                    <span className="hidden pb-2 text-right text-xs font-medium text-muted-foreground @5xl/pages:block">
                      Comments
                    </span>
                    <span className="hidden pb-2 text-xs font-medium text-muted-foreground @5xl/pages:block">
                      Status
                    </span>
                    <span className="hidden pb-2 text-right text-xs font-medium text-muted-foreground @5xl/pages:block">
                      Actions
                    </span>
                    {visible.map((page) => {
                      const name = page.title ?? page.canonicalUrl
                      return (
                        <div key={page.id} className="flex flex-col gap-3 border-t py-4 @5xl/pages:contents">
                          <div className="flex min-w-0 flex-col gap-0.5 @5xl/pages:border-t @5xl/pages:py-3">
                            <span className="font-medium break-words @5xl/pages:truncate" title={name}>
                              {name}
                            </span>
                            <a
                              className="text-xs break-all text-muted-foreground underline underline-offset-4 @5xl/pages:truncate"
                              href={page.canonicalUrl}
                              target="_blank"
                              rel="noreferrer"
                              title={page.canonicalUrl}
                            >
                              {page.canonicalUrl}
                            </a>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 @5xl/pages:contents">
                            <div className="flex items-center gap-1 @5xl/pages:border-t @5xl/pages:py-3">
                              <Hint
                                label={
                                  page.pageKey
                                    ? 'Page keys name the thread — the URL can change and comments stay together.'
                                    : 'URL-only threads are bound to this exact URL — a new URL starts a new thread.'
                                }
                              >
                                <ThreadKeyBadge pageKey={page.pageKey} />
                              </Hint>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                data-tour="pages-embed"
                                aria-label={`Copy embed config for ${page.pageKey ?? page.canonicalUrl}`}
                                onClick={() => void copyText(embedSnippet(site, page), 'Embed config copied')}
                              >
                                <Copy />
                              </Button>
                            </div>
                            <div className="text-sm tabular-nums @5xl/pages:border-t @5xl/pages:py-3 @5xl/pages:text-right">
                              <span>{page.visible} visible</span>
                              {page.hidden > 0 && <span className="text-destructive"> · {page.hidden} hidden</span>}
                            </div>
                            <div className="@5xl/pages:border-t @5xl/pages:py-3">
                              <Hint label="Locked pages reject new comments and replies until unlocked.">
                                <ThreadStatusBadge isLocked={page.isLocked} />
                              </Hint>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 @5xl/pages:justify-end @5xl/pages:border-t @5xl/pages:py-3">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="flex-1 @5xl/pages:flex-none"
                              render={<Link to="/moderation/$pageId" params={{ pageId: page.id }} search={{ site }} />}
                            >
                              View comments
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`More actions for ${name}`}
                                  />
                                }
                              >
                                <EllipsisVertical />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onLockPage(page, !page.isLocked)}>
                                  {page.isLocked ? <LockOpen /> : <Lock />}
                                  {page.isLocked ? 'Unlock page' : 'Lock page'}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(page)}>
                                  <Trash />
                                  Delete page
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <Pager total={matches.length} page={listCurrent} size={PAGE_LIST_SIZE} onPage={setListPage} />
              {pages.length >= PAGE_LIST_LIMIT && (
                <p className="text-xs text-muted-foreground">
                  Only the {PAGE_LIST_LIMIT} most recently active pages are listed.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <PageCreateDialog
        key={site}
        open={createOpen}
        onOpenChange={setCreateOpen}
        site={site}
        origins={selected?.origins ?? []}
        onCreated={onRefreshPages}
      />
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title={`Delete ${deleteTarget?.canonicalUrl ?? 'this page'}?`}
        description="This permanently deletes the page with every comment and reply on it, and their votes. The audit log keeps the page URL. This cannot be undone."
        confirmLabel="Delete page"
        pendingLabel="Deleting…"
        pending={deleting}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </>
  )
}

type PageNumber = { kind: 'page'; n: number } | { kind: 'gap'; after: number }

function pageNumbers(total: number, page: number, size: number): PageNumber[] {
  const last = Math.max(1, Math.ceil(total / size))
  const current = Math.min(Math.max(1, page + 1), last)
  const window = new Set([1, last, current - 1, current, current + 1])
  const numbers = [...window].filter((n) => n >= 1 && n <= last).sort((a, b) => a - b)
  const items: PageNumber[] = []
  for (const [index, n] of numbers.entries()) {
    const previous = numbers[index - 1]
    if (previous !== undefined && n - previous > 1) items.push({ kind: 'gap', after: previous })
    items.push({ kind: 'page', n })
  }
  return items
}

export function Pager({
  total,
  page,
  onPage,
  size,
}: {
  total: number
  page: number
  onPage: (page: number) => void
  size: number
}) {
  if (total <= size) return null
  const last = Math.max(1, Math.ceil(total / size))
  const go = (target: number) => (event: React.MouseEvent) => {
    event.preventDefault()
    const clamped = Math.min(Math.max(0, target), last - 1)
    if (clamped !== page) onPage(clamped)
  }
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#" onClick={go(page - 1)} aria-disabled={page === 0} />
        </PaginationItem>
        {pageNumbers(total, page, size).map((item) =>
          item.kind === 'gap' ? (
            <PaginationItem key={`gap-after-${item.after}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={item.n}>
              <PaginationLink href="#" isActive={item.n === page + 1} onClick={go(item.n - 1)}>
                {item.n}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext href="#" onClick={go(page + 1)} aria-disabled={page >= last - 1} />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
