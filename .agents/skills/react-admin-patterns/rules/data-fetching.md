# Data fetching

Server state in this app belongs to TanStack Query. A `useEffect` that calls
`fetch` is always a bug here: it duplicates the cache, re-fetches on every
mount, and has no way to express "this is stale" or "retry failed".

## Correct

```tsx
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

const stats = statsQuery.data ?? null
const failure = describeApiError(statsQuery.error, 'Could not load dashboard data')
```

## Incorrect

```tsx
// ✗ fetching in an effect
const [stats, setStats] = useState<DashboardStats | null>(null)
useEffect(() => {
  let cancelled = false
  fetch(`/api/admin/stats?site=${site}`).then(/* … */)
  return () => { cancelled = true }
}, [site])
```

## Rules

### `retry: false` on every admin query

A failed admin request is a state to display, not a transient hiccup. Without
`retry: false` a 401 renders three times over several seconds and the banner
appears late. Every `useQuery` in `src/routes/**`, `src/hooks/**` and
`src/lib/business-auth-client.ts` passes it.

Exception: `useAuthProviders` uses `staleTime: Infinity` + `gcTime: Infinity`
because the provider list cannot change while the app is running; it still
sets `retry: false`.

### The query key lists every input that changes the result

The key is the cache identity. Anything that changes the response belongs in
it — site, range, page id, and **the base URL**:

```tsx
// ✓ baseUrl is part of the identity
queryKey: ['blog-thread', site, baseUrl, pageUrl]

// ✗ two origins share one cache entry
queryKey: ['blog-thread', site, pageUrl]
```

### Shared keys live in one module

`src/lib/admin-sites.ts` exports `ADMIN_SITES_QUERY_KEY` and
`fetchAdminSites()`. The dashboard, the moderation list and the API-keys page
all read the same list; they must share one key so one fetch serves all three.
Never re-declare `['admin-sites']` inline — a second spelling is a second
cache entry and a second request.

### `enabled` instead of a guard in the component

```tsx
const query = useQuery({
  queryKey: ['admin-pages', site, recentDays],
  queryFn: …,
  enabled: site !== '',
  retry: false,
})
```

A component-level `if (!site) return` before the hook breaks the rules of
hooks. Use `enabled` and render the pending state instead.

### The provider is supplied by the router

`src/router.tsx` calls `setupRouterSsrQueryIntegration({ router, queryClient })`,
which installs the `QueryClientProvider` for every route. Never add a
`QueryClientProvider` by hand — a second client means a second cache.

### The session probe is a query too

`src/lib/business-auth-client.ts`:

```tsx
const probe = useQuery({
  queryKey: ['session-principal'],
  queryFn: fetchSessionPrincipal,
  staleTime: 60_000,
  retry: false,
  enabled: !betterAuthOn,
})
```

`enabled: !betterAuthOn` because the built-in provider owns its own session
via `authClient.useSession()`; the probe only answers for providers that do
not (OIDC, proxy headers). After a password sign-in the login form
invalidates `['session-principal']` so the next read sees the new session.
