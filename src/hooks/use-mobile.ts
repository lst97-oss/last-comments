import { useSyncExternalStore } from 'react'

// The JS-visible copy of Tailwind's `md` breakpoint. The media query is the
// single source of truth: the subscription and the snapshot read the same
// `matchMedia` result, so the two can never disagree.
const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches
}

// The server has no viewport, so it renders the desktop layout and the client
// corrects it on hydration, the same first paint as before.
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
