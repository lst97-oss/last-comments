'use client'

import type { Theme } from '@lst97-oss/last-comments-widgets/react'
import { useSyncExternalStore } from 'react'

// The app's theme lives on <html> (next-themes, class mode). That class is
// the one source of truth every client island can read: the React context is
// not reachable from islands rendered inside the RSC payload, while the class
// is already on the element before the first paint. The widget follows it
// through the `theme` prop, so a manual toggle flips the post body and the
// comments together with the page chrome.
function subscribe(onChange: () => void): () => void {
  if (typeof document === 'undefined') return () => {}
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

function getSnapshot(): Theme {
  if (typeof document === 'undefined') return 'system'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function useWidgetTheme(): Theme {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'system')
}
