import { ok } from '@/server/http/response'
import { requireDashboardUser } from '@/server/modules/admin/http/dashboard-guard'
import { getNotificationsPluginSettings } from '@/server/plugins/notifications/notifications.config'

export type NotificationsConfigDeps = {
  requireUser: (request: Request) => Promise<string>
  settings: typeof getNotificationsPluginSettings
}

const defaults: NotificationsConfigDeps = {
  requireUser: (request) => requireDashboardUser(request, 'Sign in to see notifications'),
  settings: getNotificationsPluginSettings,
}

// The admin bell's public settings: where the widget connects and which app it belongs to. No credential and no
// upstream call, so a notification-server outage cannot stop the bell from mounting. A disabled instance answers nulls.
export async function notificationsConfigData(
  request: Request,
  deps: NotificationsConfigDeps = defaults,
): Promise<Response> {
  await deps.requireUser(request)
  const settings = deps.settings()
  if (!settings.enabled || !settings.appKey) return ok({ baseUrl: null, appKey: null })
  return ok({ baseUrl: settings.publicUrl ?? null, appKey: settings.appKey })
}
