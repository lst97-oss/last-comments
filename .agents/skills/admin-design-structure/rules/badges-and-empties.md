# Badges, empty states and controls

## Badges

Badge **variant** carries the meaning. Never hand-roll a coloured span.

| Variant | Meaning | Examples |
|---|---|---|
| `secondary` | a normal, expected state | Open thread, site role, page key, comment count |
| `outline` | a neutral or alternative state | URL-only thread, Deleted comment, Disabled key |
| `destructive` | a problem that needs attention | Hidden comment, Blocked user |

Two badges repeat across screens, so they have shared components in
`src/components/admin/thread-status-badge.tsx`:

```tsx
<ThreadStatusBadge isLocked={page.isLocked} />   // Locked / Open
<ThreadKeyBadge pageKey={page.pageKey} />         // page key / "URL only"
```

Use them instead of re-writing the `<Badge>` with the icon — that is how
the pages list, the recent list, the thread header and the thread meta card
stayed consistent.

Icons inside a badge come from lucide (`Lock`, `LockOpen`, `Hash`) and sit
before the label.

## Empty states

Every list has one, and the copy says what to do next.

```tsx
<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon">
      <MessageSquare />
    </EmptyMedia>
    <EmptyTitle>No comments yet</EmptyTitle>
    <EmptyDescription>
      Comments show up here as soon as a page with the embed posts them.
    </EmptyDescription>
  </EmptyHeader>
</Empty>
```

- `EmptyTitle` — what is missing, short and factual.
- `EmptyDescription` — what will fill it, or what to do.
- `EmptyMedia variant="icon"` — one lucide icon that names the kind of
  thing: message square (comments), key (sites), link (pages), pin (recent).

The copy in use:

| Where | Title | Description |
|---|---|---|
| Dashboard status pie | No comments yet | Comments show up here as soon as a page with the embed posts them. |
| Thread status pie | No comments yet | This thread has no comments to show. |
| Dashboard activity chart | No comments in this period | Nothing was posted in the last {days} days. |
| Dashboard votes chart | No votes in this period | Nobody voted in the last {days} days. |
| Dashboard visible rate | No comments to rate | The rate appears once the first comment is posted. |
| Dashboard top threads | No active threads | No thread received a comment in the last {days} days. |
| Dashboard moderation | No moderation actions | Nothing was hidden, deleted or locked in the last {days} days. |
| Pages list | No pages yet | Pages appear with the first comment: send `url` to thread by URL, or `url` and `pageKey` to pin the thread to a stable key. |
| Recent list | No comments to review | Comments appear here as soon as a page with the embed posts them. |
| Sites table | No sites yet | Create your first site, then mint a site key to embed comments on your pages. |
| API keys | No site keys yet | Create your first site key — pick a site, choose permissions, copy the secret. |

The thread detail's pie passes its copy as **props** to the shared
component (`emptyTitle` / `emptyDescription`) — the panel stays shared, the
copy stays per screen.

## The site and range controls

Both live in the header, right-aligned, inside a `Field
orientation="horizontal"` so the label and the control sit on one line.

```tsx
<Field orientation="horizontal">
  <FieldTitle className="text-muted-foreground">Range</FieldTitle>
  <RangeToggle days={days} onChange={setDays} />
</Field>
```

- **Range** — always the shared `RangeToggle` (7D / 30D / 90D). Do not
  re-build a `ToggleGroup`; the narrowing logic (`'7' | '30' | '90'`) is
  inside it.
- **Site** — a `Select` with the shared `ADMIN_SITES_QUERY_KEY` query. The
  option label is the site name on the dashboard and `name (key)` in the
  moderation list, where the key matters to the admin.

## Tooltips

`Hint` (`src/components/admin/hint.tsx`) wraps a control that needs an
explanation — a copy button, an icon action:

```tsx
<Hint label="Locked pages reject new comments and replies until unlocked.">
  <Button …>{page.isLocked ? 'Unlock' : 'Lock'}</Button>
</Hint>
```

The tooltip text is part of the UX contract. When a control moves, move its
tooltip with it, verbatim.

## Buttons

- A destructive action uses `variant="destructive"`.
- A pending button shows a `Spinner` with `data-icon="inline-start"` and is
  `disabled` — never a custom spinner or a `Loading…` text swap alone.
- Icon-only buttons need `aria-label` (`size="icon-sm"` + `variant="ghost"`
  for a quiet action next to data).
