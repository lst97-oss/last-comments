# Rendering

## Keys are identities, not positions

`key={index}` on a list that can reorder, filter or shrink makes React reuse
the wrong DOM node — the classic "input keeps the old value" bug. The lint
rule `noArrayIndexKey` is enabled for this app.

```tsx
// ✗ position key
{items.map((item, index) => <li key={index}>{item.label}</li>)}

// ✓ stable identity
{items.map((item) => <li key={item.id}>{item.label}</li>)}
```

When the source has no id, build one from the data that is genuinely
unique — and say so in a comment:

```tsx
// The server groups by name, so same-name commenters collide;
// the index keeps the rows distinct.
key={`${author.authorName}-${index}`}
```

A paginator's gap marker is the same case: key it by the page it follows,
not by its position in the array.

```tsx
items.push({ kind: 'gap', after: previous })   // key={`gap-after-${item.after}`}
```

## Hoist constant objects to module scope

An object literal in JSX is a new object every render. When that object is
passed to a memoized child — or ends up in a context value — it invalidates
the memo on every render.

```tsx
// ✗ new object every render
<ChartContainer config={{ visible: { label: 'Visible', color: 'var(--chart-1)' } }}>

// ✓ stable identity
const ACTIVITY_CONFIG = {
  visible: { label: 'Visible', color: 'var(--chart-1)' },
  hidden: { label: 'Hidden', color: 'var(--chart-2)' },
}
<ChartContainer config={ACTIVITY_CONFIG}>
```

The chart panels in `src/components/admin/stats-panels.tsx` keep all four
configs at module scope for exactly this reason.

## Memoize expensive work, on primitive inputs

`useMemo` is for work that is genuinely expensive — a markdown render pass,
a large sort. It is not for a `split()` or a `filter()`.

```tsx
// ✓ one memo for the whole body, keyed on the primitive
const { segments, html } = useMemo(() => {
  const segments = splitBlogSegments(markdown)
  return {
    segments,
    html: segments.map((s) => (s.kind === 'mermaid' ? null : withCodeBlockFrames(renderMarkdown(s.content)))),
  }
}, [markdown])
```

`useMemo` is not a correctness mechanism. If a value must be correct, derive
it during render — a memo that is accidentally dropped by a dependency
change is a bug, not a performance win.

## No `useCallback` without a consumer

`useCallback` only pays off when the callback is a dependency of a memoized
child or a `useEffect` that lists it. This codebase has no first-party
`useCallback`; adding one without a consumer is noise.

## `useId` for DOM ids

Base UI and the widget components need unique DOM ids. `useId()` gives one
per component instance; a hand-written id collides when two instances mount
(the admin shows the same key row on two screens).
