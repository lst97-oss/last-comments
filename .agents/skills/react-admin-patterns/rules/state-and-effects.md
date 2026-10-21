# State and effects

The rule of thumb: **an effect may only synchronize with something outside
React.** The DOM, a timer, a subscription, a network push. Fetching,
deriving, resetting and mirroring are not effects.

## Derive during render

```tsx
// ✓ derived — no state, no effect
const site =
  siteOverride !== null && sites.some((item) => item.key === siteOverride) ? siteOverride : (sites[0]?.key ?? '')

// ✗ stored and synced by an effect
const [site, setSite] = useState('')
useEffect(() => { setSite(sites[0]?.key ?? '') }, [sites])
```

The same applies to filtered lists, visible rates, totals and `hasThread`:
compute them in the component body.

## Group state that always changes together

Two `useState` calls that are always written together are one piece of state:

```tsx
// ✗ two states that can disagree
const [error, setError] = useState('')
const [errorRequestId, setErrorRequestId] = useState('')

// ✓ one state
const [failure, setFailure] = useState<{ message: string; requestId: string } | null>(null)
setFailure({ message: '…', requestId: '…' })
```

The same reasoning applies to a draft plus its dirty flag, or a filter plus
its page cursor.

## Effects list primitive dependencies

A dependency that is a new object every render re-runs the effect every
render.

```tsx
// ✗ `segments` is a new array each render
const segments = splitBlogSegments(markdown)
useEffect(() => { … }, [segments])

// ✓ depend on the primitive input
useEffect(() => { … }, [markdown])
```

When the effect genuinely needs the derived value, derive it *inside* the
effect or memoize the derivation on the primitive input.

## Effects that stay

These are legitimate and must not be "fixed":

| Effect | Why it exists |
|---|---|
| `src/components/blog/blog-markdown.tsx` | Shiki highlights after the DOM is painted; the `AbortController` aborts a superseded pass |
| `src/components/landing/landing-code-block.tsx` | same, for the landing-page code blocks |
| `src/components/blog/mermaid-diagram.tsx` | Mermaid renders asynchronously; a generation counter lets only the latest attempt paint |
| `src/hooks/use-mobile.ts` | subscribes to a media query; `mql.matches` is the single source of truth for the breakpoint |
| `src/hooks/use-blog-thread.ts` | asks the server to create a thread that the page turned out not to have |
| `src/routes/_payload.tsx` | load-bearing unmount cleanup for the Payload admin shell |

### The blog-thread ensure effect

It asks the server to register a thread only when the page has genuinely
none. Two details matter:

```tsx
useEffect(() => {
  // Only a successful read that found no thread may ask the server to
  // create one; a failed read says nothing about the thread's existence.
  if (!enabled || !query.isSuccess || hasThread || ensuredThreads.has(pageKey)) return
  ensuredThreads.add(pageKey)
  void ensureBlogThreadServerFn({ data: { slug: pageKey } }).catch(() => {
    // A failed call releases the key again so a later mount can retry.
    ensuredThreads.delete(pageKey)
  })
}, [enabled, hasThread, pageKey, query.isSuccess])
```

`query.isPending` is wrong here: it is also true while the request failed.
`query.isSuccess` is the correct gate, and the key must be released on
failure so a remount can retry.

### Theme changes come from the theme, not from the DOM

Do not mirror `<html class="dark">` with a `MutationObserver`. The app
already owns the theme:

```tsx
const { resolvedTheme } = useTheme()   // next-themes
useEffect(() => { … }, [chart, rawId, resolvedTheme])
```

`next-themes` is mounted in `src/routes/__root.tsx`; the value changes when
the user toggles the theme, and the effect re-runs with the new value.
