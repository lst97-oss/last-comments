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

## Subscriptions use `useSyncExternalStore`

A value owned by something outside React (a media query, the theme class) is
read through `useSyncExternalStore`, not mirrored into state by an effect:

```tsx
// ✓ React reads the store during render and resubscribes when it changes
const isMobile = useSyncExternalStore(subscribe, getSnapshot, () => false)

// ✗ a copy of the store, kept in sync by an effect
const [isMobile, setIsMobile] = useState(false)
useEffect(() => { … setIsMobile(mql.matches) … }, [])
```

`src/hooks/use-mobile.ts` and `src/hooks/use-widget-theme.ts` are the examples.

## Long-lived listeners use `useEffectEvent`

A listener subscribed once must still read the latest props. Pass the handler to
`useWindowEvent(type, handler)` (`src/hooks/use-window-event.ts`), which wraps it in
`useEffectEvent`. Never put the effect event in a dependency array.

## One change that resets another uses `useReducer`

When a new search must return both list cursors to page 0, the fields that
change together belong in one reducer, so the reset cannot be forgotten at a call site:

```tsx
const [{ search, filter, directoryPage }, dispatch] = useReducer(userDirectoryReducer, INITIAL_USER_DIRECTORY)
dispatch({ type: 'search', search: value }) // also resets directoryPage
```

The reducers are pure functions in `src/lib/site-users.ts` and
`src/lib/moderation-view-state.ts`, and they are unit-tested directly.

## Pending state for async actions uses `useTransition`

`const [pending, startTransition] = useTransition()` tracks an async action
without a `setPending(true)` / `finally` pair. The action must resolve rather
than reject (for example, to a boolean), because an unhandled rejection escapes
the transition.

## Effects that stay

These are legitimate and must not be "fixed":

| Effect | Why it exists |
|---|---|
| `src/components/blog/blog-markdown.tsx` | Shiki highlights after the DOM is painted; the `AbortController` aborts a superseded pass |
| `src/components/landing/landing-code-block.tsx` | same, for the landing-page code blocks |
| `src/components/blog/mermaid-diagram.tsx` | Mermaid renders asynchronously; its result is keyed on theme and chart, and a generation counter lets only the latest attempt paint |
| `src/hooks/use-window-event.ts` | subscribes a window event listener; the handler is an effect event, so the listener is not re-added when the handler changes |
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
