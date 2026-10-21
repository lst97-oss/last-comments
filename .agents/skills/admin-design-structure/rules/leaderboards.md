# Leaderboards

`Leaderboard` (`src/components/admin/leaderboard.tsx`) renders a ranked
name + value + bar list. It replaced a horizontal bar chart whose labels
were squeezed into a fixed axis gutter — a long author name ate the bar's
space and the numbers became unreadable.

## The layout

```
┌──────────────────────────────────┐
│ A very long author name here    12│   ← name row, value right-aligned
│ ████████████████░░░░░░░░░░░░░░░░░│   ← full-width bar below
├──────────────────────────────────┤
│ Another author                    7│
│ █████████░░░░░░░░░░░░░░░░░░░░░░░░│
└──────────────────────────────────┘
```

- The **name is on its own line**, above the bar. The bar is then always
  full width, whatever the name length.
- The **value is right-aligned** on the name row (`ProgressValue` carries
  `ml-auto`).
- The **label truncates** (`truncate`) and keeps the full text in `title`,
  so a long name is still readable on hover.

## Normalization

```tsx
const max = Math.max(1, ...items.map((item) => item.value))
```

Every bar is relative to the largest value, so the top row is always full.
The `Math.max(1, …)` floor matters: a list of zeros would otherwise make
`max` zero and the `Progress` would compute a divide-by-zero percentage.

## Accessibility

Base UI's `Progress` announces `aria-valuetext` as a **percentage** of
`value / max`, while the visible `ProgressValue` shows the raw count. On a
"12 comments" row a screen reader would say "45%".

Override it:

```tsx
<Leaderboard
  items={…}
  ariaValueText={(item) => `${item.label}, ${item.value} comments`}
/>
```

The prop is optional — pass it whenever the number is a count rather than a
percentage.

## Items

```tsx
export type LeaderboardItem = {
  key: string     // stable identity for the row
  label: string   // full label; also the hover title
  value: number
}
```

`key` is a **stable identity**, not a position. When the data has no id,
build one from what is genuinely unique and say why in a comment:

```tsx
// The server groups by name, so same-name commenters collide;
// the index keeps the rows distinct.
key: `${author.authorName}-${index}`
```

## A richer label

`renderLabel` replaces the plain text with any node — usually a link:

```tsx
renderLabel={(item) => (
  <Link to="/moderation/$pageId" params={{ pageId: item.key }} search={{ site }}>
    {item.label}
  </Link>
)}
```

The `key` doubles as the link parameter, so a leaderboard item's `key`
should be the id the destination needs.

## Thread labels

A page may have no title. `threadLabel(title, canonicalUrl)` (from
`src/lib/admin-format.ts`) falls back to the last path segment, so the bar
chart always has a readable label:

```tsx
label: threadLabel(page.title, page.canonicalUrl)
```

## Empty state

`Leaderboard` renders nothing when `items` is empty unless an `empty`
node is passed. Pass the screen's `Empty` block:

```tsx
empty={
  <Empty>
    <EmptyHeader>
      <EmptyTitle>No active threads</EmptyTitle>
      <EmptyDescription>No thread received a comment in the last {days} days.</EmptyDescription>
    </EmptyHeader>
  </Empty>
}
```

The two leaderboards differ in what they rank: the dashboard ranks
**threads** (each row links to the thread), the thread detail ranks
**authors** (plain text, no link).
