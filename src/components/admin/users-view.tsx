'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { Search, Users } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import { AdminQueryError } from '@/components/admin/admin-query-error'
import { Pager } from '@/components/admin/pages-view'
import { UserHistoryDrawer } from '@/components/admin/user-history-drawer'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/components/ui/toast'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { authorInitials, timeAgo } from '@/lib/admin-format'
import { describeApiError, readApiData } from '@/lib/api-response'
import { type SiteUser, type UserDirectoryFilter } from '@/lib/site-users'

const USER_LIST_SIZE = 10

function formatDateTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

export function UsersView({ site }: { site: string }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<UserDirectoryFilter>('all')
  const [directoryPage, setDirectoryPage] = useState(0)
  const [blockedPage, setBlockedPage] = useState(0)
  const [historyUser, setHistoryUser] = useState<SiteUser | null>(null)
  // The list query is keyed on the deferred needle so typing does not fire a
  // request per keystroke; the input itself stays immediate.
  const needle = useDeferredValue(search.trim())

  const directoryQuery = useQuery({
    queryKey: ['admin-users', site, needle, filter, directoryPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        site,
        filter,
        limit: String(USER_LIST_SIZE),
        offset: String(directoryPage * USER_LIST_SIZE),
      })
      if (needle) params.set('search', needle)
      const response = await fetch(`/api/admin/users?${params}`)
      return readApiData<{ users: SiteUser[]; total: number }>(response)
    },
    enabled: site !== '',
    retry: false,
  })
  const blockedQuery = useQuery({
    queryKey: ['admin-users', site, needle, 'blocked', blockedPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        site,
        filter: 'blocked',
        limit: String(USER_LIST_SIZE),
        offset: String(blockedPage * USER_LIST_SIZE),
      })
      if (needle) params.set('search', needle)
      const response = await fetch(`/api/admin/users?${params}`)
      return readApiData<{ users: SiteUser[]; total: number }>(response)
    },
    enabled: site !== '',
    retry: false,
  })

  const directory = directoryQuery.data?.users ?? []
  const directoryTotal = directoryQuery.data?.total ?? 0
  const blocked = blockedQuery.data?.users ?? []
  const blockedTotal = blockedQuery.data?.total ?? 0
  const queryError = directoryQuery.error ?? blockedQuery.error
  const failure = describeApiError(queryError, 'Could not load users')

  const blockMutation = useMutation({
    mutationFn: async ({ userId, blocked }: { userId: string; blocked: boolean }) => {
      const response = await fetch('/api/moderation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ site, target: 'user', userId, blocked }),
      })
      await readApiData<{ userId: string; blocked: boolean }>(response)
      return { userId, blocked }
    },
    onSuccess: async ({ userId, blocked }) => {
      // The open drawer holds its own snapshot of the user — keep its badge
      // in sync without refetching the history list.
      setHistoryUser((current) =>
        current && current.userId === userId
          ? { ...current, blocked, blockedReason: blocked ? current.blockedReason : null }
          : current,
      )
      await Promise.all([directoryQuery.refetch(), blockedQuery.refetch()])
      toast.add({
        title: blocked ? 'User blocked' : 'User unblocked',
        description: blocked ? 'Their sessions stay signed in, but posting is rejected.' : undefined,
        type: 'success',
      })
    },
    onError: (cause) =>
      toast.add({
        title: 'Could not update user',
        description: cause instanceof Error ? cause.message : 'Please try again.',
        type: 'error',
      }),
  })

  function searchUsers(value: string) {
    setSearch(value)
    setDirectoryPage(0)
    setBlockedPage(0)
  }

  function changeFilter(next: UserDirectoryFilter) {
    setFilter(next)
    setDirectoryPage(0)
  }

  if (queryError) {
    return (
      <AdminQueryError
        failure={failure}
        forbiddenTitle="User management is restricted to administrators."
        onRetry={
          failure.forbidden
            ? undefined
            : () => {
                if (directoryQuery.error) void directoryQuery.refetch()
                if (blockedQuery.error) void blockedQuery.refetch()
              }
        }
      />
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            {directoryTotal === 0
              ? 'Everyone who commented or belongs to this site appears here, newest registration first.'
              : `${directoryTotal} ${directoryTotal === 1 ? 'user' : 'users'} · newest registration first`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(event) => searchUsers(event.target.value)}
                placeholder="Search name or email"
                aria-label="Search users"
                className="pl-9"
              />
            </div>
            <ToggleGroup
              aria-label="User filter"
              value={[filter]}
              onValueChange={(next) => {
                const picked = next[0]
                if (picked === 'all' || picked === 'blocked') changeFilter(picked)
              }}
            >
              <ToggleGroupItem value="all" variant="outline" size="sm">
                All
              </ToggleGroupItem>
              <ToggleGroupItem value="blocked" variant="outline" size="sm">
                Blocked
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          {directoryQuery.isPending ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Loading users…
            </p>
          ) : directory.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>{filter === 'blocked' ? 'No blocked users' : 'No users yet'}</EmptyTitle>
                <EmptyDescription>
                  {filter === 'blocked'
                    ? 'Blocked users appear here with their reason and expiry.'
                    : 'Users appear with their first comment or site membership.'}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <UserTable
                users={directory}
                blockPending={blockMutation.isPending}
                onHistory={setHistoryUser}
                onToggleBlock={(userId, blocked) => blockMutation.mutate({ userId, blocked })}
              />
              <Pager total={directoryTotal} page={directoryPage} size={USER_LIST_SIZE} onPage={setDirectoryPage} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Blocked users</CardTitle>
          <CardDescription>
            {blockedTotal === 0
              ? 'Nobody is blocked on this site.'
              : `${blockedTotal} blocked ${blockedTotal === 1 ? 'user' : 'users'} · posting is rejected while blocked`}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {blockedQuery.isPending ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Loading blocked users…
            </p>
          ) : blocked.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Users />
                </EmptyMedia>
                <EmptyTitle>No blocked users</EmptyTitle>
                <EmptyDescription>Block a user above to revoke their posting access.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              <UserTable
                users={blocked}
                blockPending={blockMutation.isPending}
                onHistory={setHistoryUser}
                onToggleBlock={(userId, blocked) => blockMutation.mutate({ userId, blocked })}
              />
              <Pager total={blockedTotal} page={blockedPage} size={USER_LIST_SIZE} onPage={setBlockedPage} />
            </>
          )}
        </CardContent>
      </Card>

      <UserHistoryDrawer
        user={historyUser}
        site={site}
        open={historyUser !== null}
        onOpenChange={(open) => !open && setHistoryUser(null)}
        blockPending={blockMutation.isPending}
        onToggleBlock={(userId, blocked) => blockMutation.mutate({ userId, blocked })}
      />
    </>
  )
}

function UserTable({
  users,
  blockPending,
  onHistory,
  onToggleBlock,
}: {
  users: SiteUser[]
  blockPending: boolean
  onHistory: (user: SiteUser) => void
  onToggleBlock: (userId: string, blocked: boolean) => void
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead>Comments</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.userId}>
            <TableCell>
              <div className="flex items-center gap-2">
                <Avatar size="sm" title={user.name}>
                  <AvatarFallback>{authorInitials(user.name)}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto justify-start p-0 font-medium"
                    onClick={() => onHistory(user)}
                    title={`View ${user.name}'s comment history`}
                  >
                    <span className="truncate">{user.name}</span>
                  </Button>
                  <span className="truncate text-xs text-muted-foreground" title={user.email}>
                    {user.email}
                  </span>
                </div>
              </div>
            </TableCell>
            <TableCell>
              {user.role ? (
                <Badge variant="secondary">{user.role === 'admin' ? 'Site admin' : 'Moderator'}</Badge>
              ) : (
                <Badge variant="outline">Commenter</Badge>
              )}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              <time dateTime={user.createdAt} title={formatDateTime(user.createdAt)}>
                {timeAgo(user.createdAt)}
              </time>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {user.commentsTotal} ·{' '}
              {user.lastCommentAt ? (
                <time dateTime={user.lastCommentAt} title={formatDateTime(user.lastCommentAt)}>
                  active {timeAgo(user.lastCommentAt)}
                </time>
              ) : (
                'never posted'
              )}
            </TableCell>
            <TableCell>
              {user.blocked ? (
                <Badge variant="destructive" title={user.blockedReason ?? 'No reason given'}>
                  Blocked
                </Badge>
              ) : (
                <Badge variant="secondary">Active</Badge>
              )}
            </TableCell>
            <TableCell className="text-right">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={blockPending}
                onClick={() => onToggleBlock(user.userId, !user.blocked)}
              >
                {user.blocked ? 'Unblock' : 'Block'}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
