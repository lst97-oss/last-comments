# Charts

All four admin chart panels live in `src/components/admin/stats-panels.tsx`
and are used by both the dashboard and the thread detail. The same component
on both screens is what makes the two read as one product.

## The four panels

### `CommentActivityPanel({ days, windowComments, series, className })`

Visible and hidden comments per day, stacked area chart.

- `className="lg:col-span-2"` — it takes two of the three columns.
- Empty when `windowComments === 0`: "No comments in this period" /
  "Nothing was posted in the last {days} days."

### `CommentStatusPie({ totals, emptyTitle, emptyDescription })`

All comments by status, donut chart with a legend.

- `innerRadius={48}` `outerRadius={72}` `paddingAngle={2}` — the standard
  donut proportions; the hole holds nothing, the ring is the data.
- The three slices are `visible` / `hidden` / `deleted`, always in that
  order.
- The empty copy is per screen, passed as props: the dashboard says
  "Comments show up here as soon as a page with the embed posts them.", the
  thread says "This thread has no comments to show."

### `VotesPanel({ days, votesUp, votesDown, series })`

Upvotes and downvotes per day, grouped bar chart, `radius={[4, 4, 0, 0]}`.

- Empty when `votesUp + votesDown === 0`: "No votes in this period" /
  "Nobody voted in the last {days} days."

### `VisibleRatePanel({ totals })`

The share of comments that are visible, as a radial gauge.

- The rate is computed inside the panel: `totals.comments === 0 ? 0 :
  Math.round((totals.visible / totals.comments) * 100)`.
- The chart draws the ring; the number is a **centred overlay**, not part
  of the chart — `<span className="text-3xl font-semibold tabular-nums">`
  over `<span className="text-xs text-muted-foreground">visible</span>`.
- `PolarAngleAxis domain={[0, 100]}` with `tick={false}` — the axis is
  invisible; only the ring is.
- Empty when there are no comments: "No comments to rate" / "The rate
  appears once the first comment is posted."

## Colours

Chart colours are CSS variables, never literal colours:

```tsx
const ACTIVITY_CONFIG = {
  visible: { label: 'Visible', color: 'var(--chart-1)' },
  hidden: { label: 'Hidden', color: 'var(--chart-2)' },
}
```

The variables come from the theme (`--chart-1` … `--chart-6`), so the
charts follow light/dark automatically. A literal hex value would break in
one of the two themes.

The configs are **module constants**. A literal in JSX creates a new object
every render, which re-creates the chart context value and invalidates the
memoized tooltip.

## Axis and tooltip conventions

- `tickLine={false} axisLine={false}` on every axis — the grid carries the
  scale.
- `tickFormatter={(value: string) => value.slice(5)}` on the day axis
  (the server sends `YYYY-MM-DD`).
- The tooltip's `labelFormatter` uses the shared `formatDay(day)` from
  `src/lib/admin-format.ts`, so the tooltip reads "Mar 4" on every screen.
- `YAxis allowDecimals={false} width={32}` — counts are integers.

## Verifying a chart renders

**A headless screenshot of a recharts path is blank when the fill is a CSS
variable.** The DOM has the correct path geometry, computed fill and clip;
the pixels just do not rasterize. A plain probe `<rect>` injected into the
same SVG is invisible too. This is a capture artifact, not an app bug.

Verify in the DOM:

```js
const chart = document.querySelector('[data-slot="chart"]')
chart.querySelectorAll('path, rect, circle').length          // marks exist
getComputedStyle(chart.querySelector('path')).fill            // the resolved colour
```

Then take a **viewport** screenshot (scroll the chart into view with
`scrollIntoView({ block: 'center' })`) for the visual check. A `fullPage`
or element screenshot is not a valid chart check.

## A chart panel must accept its data as props

The panels take `days`, `windowComments`, `series` / `totals` — they never
fetch. The screen owns the query; the panel owns the rendering. That split
is why the dashboard and the thread detail can share them.
