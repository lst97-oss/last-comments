import { useEffect, useEffectEvent } from 'react'

// Listens for a window event for the component's lifetime. The handler is an
// effect event, so it always sees the latest props while the listener stays
// subscribed once per event type.
export function useWindowEvent(type: string, handler: () => void) {
  const onEvent = useEffectEvent(handler)
  useEffect(() => {
    const listener = () => onEvent()
    window.addEventListener(type, listener)
    return () => window.removeEventListener(type, listener)
  }, [type])
}
