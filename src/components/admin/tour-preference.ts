import { useSyncExternalStore } from 'react'

// A per-browser choice: this browser hides the "Take a tour" button. Storage can be unavailable (private windows,
// blocked site data), so every access is guarded and the button stays visible when the value cannot be read.
const STORAGE_KEY = 'last-comments:admin-hide-tour'
const CHANGE_EVENT = 'last-comments:admin-hide-tour-change'

function readHidden(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setTourHidden(hidden: boolean): void {
  try {
    if (hidden) window.localStorage.setItem(STORAGE_KEY, '1')
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Unwritable storage leaves the choice unchanged.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

// The server and the first client render show the button; the stored choice applies after hydration.
export function useTourHidden(): boolean {
  return useSyncExternalStore(subscribe, readHidden, () => false)
}
