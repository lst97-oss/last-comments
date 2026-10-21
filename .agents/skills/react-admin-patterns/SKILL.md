---
name: react-admin-patterns
description: "React best practices for the last-comments admin app — TanStack Query for server state, useMutation for writes, no data-fetching effects, shared admin components, and the lint rules that enforce them. Use when adding or changing anything under src/routes/**, src/components/admin/**, src/hooks/**, or src/lib/business-auth-client.ts."
---

# React patterns for the admin app

The admin app (`/dashboard`, `/moderation`, `/moderation/$pageId`, `/api-keys`,
`/create-admin-user`) has one house style. Read the rules below before writing
a component that fetches, mutates, or renders admin chrome.

## The one-line version

> Server state lives in `useQuery`. Writes live in `useMutation`. Everything
> else is derived during render. There is no `useEffect` that fetches.

## Critical rules

These are enforced by `biome check` on `src/routes/**`, `src/components/admin/**`,
`src/hooks/**`, `src/lib/**` (see `biome.json` → `linter` + `overrides`).

### Data fetching → [rules/data-fetching.md](./rules/data-fetching.md)

- **Never fetch in `useEffect`.** Server state goes through `useQuery` from
  `@tanstack/react-query`. The provider is supplied by the router
  (`src/router.tsx` → `setupRouterSsrQueryIntegration`) — never add a
  `QueryClientProvider` by hand.
- **Every admin query sets `retry: false`.** A 401/403 must render the banner
  immediately, not after three silent retries.
- **The query key lists every input that changes the result.** A key missing
  `baseUrl` or `site` serves one site's data under another's key.
- **Read the shared site list through `ADMIN_SITES_QUERY_KEY`**
  (`src/lib/admin-sites.ts`) so the dashboard, moderation and API-keys pages
  share one cache entry. Never re-declare the key inline.

### Writes → [rules/mutations.md](./rules/mutations.md)

- **Every write is a `useMutation`.** No `await fetch(...)` followed by a
  manual `refetch()`.
- **The mutation owns the invalidation** (`onSuccess` / `onSettled`), so the
  cache is never left stale by a forgotten call site.
- **Pending state disables its own control.** A double click must not fire two
  requests: `disabled={mutation.isPending}` plus a `Spinner`.
- **A failed write leaves the dialog open** so the admin can retry. Return a
  boolean from the mutation and close the dialog only on `true`.

### State and effects → [rules/state-and-effects.md](./rules/state-and-effects.md)

- **Derive during render.** A value computable from props/state is a `const`
  in the component body, not `useState` + `useEffect`.
- **Group state that always changes together.** `error` + `errorRequestId` are
  one `useState<{ message: string; requestId: string } | null>`.
- **An effect may only sync with something outside React**: the DOM, a
  network push, a timer. Fetching, deriving and resetting are not effects.
- **Effects list primitive dependencies.** Depend on `markdown`, not on
  `segments` (an array recreated every render).

### Rendering → [rules/rendering.md](./rules/rendering.md)

- **Keys are stable identities, not positions.** `key={index}` on a list that
  reorders is a bug; the lint rule `noArrayIndexKey` catches it.
- **Memoize only expensive work, on primitive inputs.** `useMemo` for a
  markdown render pass, not for a `split()`.
- **Hoist constant objects to module scope.** A `config={{ … }}` literal in
  JSX re-creates the object every render and invalidates memoized children.
- **Component-level `'use memo'`** (inside the function body, not at the top
  of the file) opts a component into the React Compiler — see
  [rules/react-compiler.md](./rules/react-compiler.md).

### Shared admin components → [rules/shared-components.md](./rules/shared-components.md)

Before writing admin UI, check whether it already exists:

| Need | Use |
|---|---|
| Error / failure banner | `AdminQueryError` (`src/components/admin/admin-query-error.tsx`) |
| Text input bound to a form field | `AccountTextField` (`account-field.tsx`) |
| Dialog with a form + submit button | `FormDialog` (`form-dialog.tsx`) |
| Stat card, chart panel, activity table | `stats-panels.tsx` |
| Ranked name + value + bar list | `Leaderboard` (`leaderboard.tsx`) |
| 7/30/90-day switch | `RangeToggle` (`range-toggle.tsx`) |
| Locked/Open and page-key badges | `thread-status-badge.tsx` |
| Tooltip wrapper for a control | `Hint` (`hint.tsx`) |
| Destructive confirmation | `ConfirmDeleteDialog` (`confirm-delete-dialog.tsx`) |

Two screens needing the same markup means one shared component. Copy-paste
between `dashboard.tsx` and `moderation_.$pageId.tsx` is what created the
duplication this list now removes.

## Verifying a change

```bash
bun run typecheck                 # bun check, must be clean
bunx @biomejs/biome check src     # hook/key rules, must be clean
bun test                          # 262 pass expected
bun run smoke                     # against a running dev server
```

Then drive the screen in a browser: a mutation must show its pending state,
must not double-fire, and a failed request must leave the dialog open with
the message visible. See the `last-comments-live-admin-verify` skill for the
minted-session setup and the "never blind-click admin controls" safety rule.

## Reference

- [rules/data-fetching.md](./rules/data-fetching.md) — `useQuery`, keys, `retry: false`
- [rules/mutations.md](./rules/mutations.md) — `useMutation`, invalidation, pending
- [rules/state-and-effects.md](./rules/state-and-effects.md) — what may be an effect
- [rules/rendering.md](./rules/rendering.md) — keys, memoization, module constants
- [rules/react-compiler.md](./rules/react-compiler.md) — `'use memo'` and the compiler
- [rules/shared-components.md](./rules/shared-components.md) — the admin component catalogue
