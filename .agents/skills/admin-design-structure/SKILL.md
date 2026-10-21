---
name: admin-design-structure
description: "Design structure of the last-comments admin console — how the dashboard, moderation and thread-detail screens are laid out, how charts and leaderboards read, and the visual decisions that keep the three screens consistent. Use when designing or restyling an admin screen, adding a chart, a stat card, a leaderboard, a badge, or an empty state."
---

# Admin design structure

The admin console has three screens that must look like one product:
`/dashboard` (site-wide), `/moderation` (the tabs) and
`/moderation/$pageId` (one thread). They share their stat cards, their
charts, their leaderboards and their activity tables — the same components,
so the same numbers read the same way on all three.

## The screen skeleton

Every admin screen is:

```
DashboardShell
└── main (max-w-5xl / max-w-6xl, flex flex-col gap-6, text-foreground)
    ├── header            title + subtitle, optional site/range controls
    ├── [error banner]   AdminQueryError, when a request failed
    ├── [loading line]   Spinner + text, aria-live="polite"
    ├── section Summary   aria-label="Summary"   4 stat cards
    ├── section Trends    aria-label="Trends"    activity area chart + status pie
    ├── section Breakdown aria-label="Breakdown" votes bar chart + leaderboard + visible-rate gauge
    ├── section Thread    aria-label="Thread"    (thread detail only)
    └── section Comments  aria-label="Comments"  (thread detail only)
```

**Keep the `aria-label` on each section.** They are the landmarks a screen
reader navigates by, and they are the only thing that keeps the three
screens' structure comparable.

**Keep the order.** Summary → Trends → Breakdown. The dashboard and the
thread detail use the same order so a reader who learns one screen knows
the other.

**The grid rhythm.** `grid gap-4 md:grid-cols-2 lg:grid-cols-4` for the
four stat cards, `grid gap-4 lg:grid-cols-3` for the chart rows (the
activity chart takes `lg:col-span-2`), `grid gap-4 lg:grid-cols-2` for the
thread row.

## The stat card

`StatCard` from `src/components/admin/stats-panels.tsx`:

```tsx
<StatCard
  title="Total comments"
  description="All comments ever posted"
  value={totals.comments.toLocaleString()}
  footnote={`+${stats.window.comments.toLocaleString()} in the last ${days} days`}
  action={<CardAction><Button …>Review</Button></CardAction>}
/>
```

- The value is `text-3xl font-semibold tabular-nums` — `tabular-nums` so
  the digits do not jitter when the number changes.
- The footnote is `text-xs text-muted-foreground` and always says *what the
  number means*, not "updated at …".
- The action (a `CardAction`) only appears when there is somewhere to go.
- The four dashboard cards and the four thread cards are the same four
  slots. The dashboard's "Threads" card is the thread's "Participants"
  card; both are "a count plus a breakdown of it".

## The charts

Four panels, all from `stats-panels.tsx`, all sharing one look:

| Panel | Chart | Height | Empty copy |
|---|---|---|---|
| `CommentActivityPanel` | area, visible + hidden stacked | `h-[240px]` | "No comments in this period" |
| `CommentStatusPie` | pie, visible/hidden/deleted | `max-h-[260px]`, square | "No comments yet" + per-screen description |
| `VotesPanel` | bar, votes up + down | `h-[220px]` | "No votes in this period" |
| `VisibleRatePanel` | radial gauge | `max-h-[220px]`, square | "No comments to rate" |

- **Chart colours are CSS variables**, never literals: `--chart-1`,
  `--chart-2`, `--chart-3`. The palette follows the theme.
- **The config object is a module constant** in `stats-panels.tsx`, so the
  chart context and the tooltip keep a stable identity.
- **The gauge's number is overlaid, not in the chart**: the `RadialBarChart`
  draws the ring, and a centred `<span>` shows `{visibleRate}%` on top of it.
- **Empty states use `Empty`**, with the screen-specific description passed
  as a prop (`emptyTitle` / `emptyDescription`).

### Verifying a chart renders

A headless `fullPage` or element screenshot shows recharts paths as
**blank** when their fill is a CSS variable — the DOM has the right
geometry, the pixels just do not rasterize. Do not "fix" that.

Verify in the DOM instead:

```js
getComputedStyle(document.querySelector('[data-slot="chart"] path')).fill
```

and take a **viewport** screenshot (scroll the chart into view) for the
visual check.

## The leaderboard

`Leaderboard` from `src/components/admin/leaderboard.tsx`:

- **The name is on its own line above a full-width bar.** A long author
  name must never eat the bar's space — that was the whole point of the
  redesign. The value sits to the right of the label, on the same row.
- **Bars are normalized to the maximum** (`max={max}`), so the top row is
  always full. `max` is floored at 1 so an all-zero list does not divide by
  zero.
- **The row is a `Progress`**, so it carries the progress semantics for
  free; pass `ariaValueText` so it announces the count, not a percentage.
- **The label is truncated with `title`** so the full name is still
  available on hover.
- **The dashboard's "Top threads" rows link to the thread detail**; the
  thread's "Top authors" rows are plain text.

## Badges

| Badge | Component | Where |
|---|---|---|
| Locked / Open | `ThreadStatusBadge` | pages list, recent list, thread header |
| page key / `URL only` | `ThreadKeyBadge` | pages list, thread header |
| site role | `Badge variant="secondary"` | sites table |
| comment status | `Badge variant="destructive"` / `outline` | recent previews |

Badge **variants** carry the meaning: `secondary` for a normal state,
`outline` for a neutral one, `destructive` for a problem. Never hand-roll a
coloured span.

## Empty states

Every list has one, and the copy says what to do next:

- "No pages yet" → "Threads are created by the first comment on a page URL."
- "No sites yet" → "Create your first site, then mint a site key…"
- "No comments yet" → "Comments show up here as soon as a page with the embed posts them."

The `EmptyMedia` icon marks the kind (message square, key, link, pin).

## The site and range controls

Both screens put them in the header, right-aligned, in a `Field
orientation="horizontal"`:

- **Site** — a `Select` whose option label is the site name on the
  dashboard and `name (key)` in the moderation list.
- **Range** — the shared `RangeToggle` (7D / 30D / 90D). Both screens use
  it so the two cannot drift.

## Thread detail specifics

- The breadcrumb (`Pages / <thread title>`) sits above the header.
- The header shows the canonical URL, the lock badge and the page-key badge.
- The "Thread" card (meta + embed config) and the "Moderation activity"
  card sit side by side in `lg:grid-cols-2`.
- The comments widget is in its own `aria-label="Comments"` section, with
  the theme taken from `useTheme()` so it matches the admin shell.

## Reference

- [rules/screens.md](./rules/screens.md) — the screen skeleton, section order, grids
- [rules/charts.md](./rules/charts.md) — the four panels, colours, empty states, verification
- [rules/leaderboards.md](./rules/leaderboards.md) — the ranked list layout
- [rules/badges-and-empties.md](./rules/badges-and-empties.md) — badges, empty copy, controls
