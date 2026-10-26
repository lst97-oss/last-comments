'use client'

import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { useState } from 'react'
import { Pager } from '@/components/admin/pages-view'
import { threadPreviewExcerpt } from '@/components/admin/recent-view'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from '@/components/ui/item'
import { authorInitials, timeAgo } from '@/lib/admin-format'
import { readApiData } from '@/lib/api-response'
import { type SiteUser, type UserCommentHistoryItem } from '@/lib/site-users'

const HISTORY_PAGE_SIZE = 20

export function UserHistoryDrawer({
  user,
  site,
  open,
  onOpenChange,
  blockPending,
  onToggleBlock,
}: {
  user: SiteUser | null
  site: string
  open: boolean
  onOpenChange: (open: boolean) => void
  blockPending: boolean
  onToggleBlock: (userId: string, blocked: boolean) => void
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        {user && (
          <HistoryBody
            key={user.userId}
            user={user}
            site={site}
            blockPending={blockPending}
            onToggleBlock={onToggleBlock}
          />
        )}
      </DrawerContent>
    </Drawer>
  )
}

function HistoryBody({
  user,
  site,
  blockPending,
  onToggleBlock,
}: {
  user: SiteUser
  site: string
  blockPending: boolean
  onToggleBlock: (userId: string, blocked: boolean) => void
}) {
  // Keyed by user id from the parent, so switching users resets the cursor
  // through a remount instead of an effect.
  const [page, setPage] = useState(0)
  const historyQuery = useQuery({
    queryKey: ['user-comments', site, user.userId, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        site,
        limit: String(HISTORY_PAGE_SIZE),
        offset: String(page * HISTORY_PAGE_SIZE),
      })
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.userId)}/comments?${params}`)
      return readApiData<{ comments: UserCommentHistoryItem[]; total: number }>(response)
    },
    retry: false,
  })
  const comments = historyQuery.data?.comments ?? []
  const total = historyQuery.data?.total ?? 0

  return (
    <>
      <DrawerHeader>
        <div className="flex items-center gap-3">
          <Avatar title={user.name}>
            <AvatarFallback>{authorInitials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <DrawerTitle className="truncate">{user.name}</DrawerTitle>
            <DrawerDescription className="truncate">
              {user.email} · joined {timeAgo(user.createdAt)}
            </DrawerDescription>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Badge variant="secondary">{user.role === 'admin' ? 'Site admin' : 'Member'}</Badge>
          {user.blocked ? (
            <Badge variant="destructive" title={user.blockedReason ?? 'No reason given'}>
              Blocked
            </Badge>
          ) : (
            <Badge variant="secondary">Active</Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {total} {total === 1 ? 'comment' : 'comments'} on this site
          </span>
        </div>
      </DrawerHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {historyQuery.isPending ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Loading comment history…
          </p>
        ) : historyQuery.error ? (
          <p className="text-sm text-destructive" role="alert">
            {historyQuery.error instanceof Error ? historyQuery.error.message : 'Could not load comment history.'}
          </p>
        ) : comments.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <History />
              </EmptyMedia>
              <EmptyTitle>No comments on this site</EmptyTitle>
              <EmptyDescription>This user belongs to the site but has not posted here yet.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <ItemGroup>
              {comments.map((comment) => (
                <Item key={comment.id} variant="outline" size="sm">
                  <ItemContent>
                    <ItemTitle>
                      <a
                        className="truncate underline"
                        href={comment.canonicalUrl}
                        target="_blank"
                        rel="noreferrer"
                        title={comment.pageTitle ?? comment.canonicalUrl}
                      >
                        {comment.pageTitle ?? comment.canonicalUrl}
                      </a>
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
                    {comment.status === 'hidden' ? (
                      <Badge variant="destructive">Hidden</Badge>
                    ) : comment.status === 'deleted' ? (
                      <Badge variant="outline">Deleted</Badge>
                    ) : null}
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
            <Pager total={total} page={page} size={HISTORY_PAGE_SIZE} onPage={setPage} />
          </>
        )}
      </div>
      <DrawerFooter className="flex-row justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={blockPending}
          onClick={() => onToggleBlock(user.userId, !user.blocked)}
        >
          {user.blocked ? 'Unblock user' : 'Block user'}
        </Button>
        <DrawerClose render={<Button type="button" variant="secondary" size="sm" />}>Close</DrawerClose>
      </DrawerFooter>
    </>
  )
}
