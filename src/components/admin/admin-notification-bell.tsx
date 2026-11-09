'use client'

import {
  type InboxError,
  NotificationBell,
  NotificationBellUnavailable,
} from '@lst97-oss/last-notifications-widgets/react'
import { useQuery } from '@tanstack/react-query'
import { useWidgetTheme } from '@/hooks/use-widget-theme'

type BellConfig = {
  baseUrl: string | null
  appKey: string | null
}

// Public settings only: where the bell connects and which app it belongs to. No credential is involved.
async function readConfig(): Promise<BellConfig> {
  const response = await fetch('/api/notifications-config', { credentials: 'same-origin' })
  if (!response.ok) throw new Error(`notifications config request failed (${response.status})`)
  return ((await response.json()) as { data: BellConfig }).data
}

// The browser console only: the bell already shows its own error, and a toast on every background retry would be noise.
function reportBellError(error: InboxError) {
  console.warn('[notifications]', error.source, error.code, error.retryable, error.requestId)
}

// The admin's bell. Renders nothing while notifications are off. When the config cannot be read, it shows the same
// error bell the widget shows for a failed token, so a dashboard outage is visible rather than silent.
export function AdminNotificationBell({ userId }: { userId: string }) {
  const config = useQuery({
    queryKey: ['admin-notifications-config', userId],
    queryFn: readConfig,
    retry: false,
    staleTime: 5 * 60_000,
  })
  // Follows the dashboard's light/dark toggle (the `dark` class on <html>), so the bell matches the page.
  const theme = useWidgetTheme()
  if (config.isError) return <NotificationBellUnavailable onRetry={() => void config.refetch()} theme={theme} />
  if (!config.data?.baseUrl || !config.data.appKey) return null
  return (
    <NotificationBell
      baseUrl={config.data.baseUrl}
      appKey={config.data.appKey}
      session={userId}
      tokenUrl="/api/notifications-token"
      onError={reportBellError}
      theme={theme}
    />
  )
}
