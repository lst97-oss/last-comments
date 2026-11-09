import {
  ApiError,
  createNotificationsClient,
  type NotificationsClient,
} from '@lst97-oss/last-notifications-widgets/server'

import { ErrorCode, HttpError } from '@/server/http/errors'
import { ok } from '@/server/http/response'
import { requireDashboardUser } from '@/server/modules/admin/http/dashboard-guard'
import { getRequestLogger } from '@/server/observability/logger'
import { getNotificationsPluginSettings } from '@/server/plugins/notifications/notifications.config'

export type NotificationsTokenDeps = {
  requireUser: (request: Request) => Promise<string>
  settings: typeof getNotificationsPluginSettings
  createClient: (options: {
    baseUrl: string
    appKey: string
    apiKey: string
    requestId?: string
  }) => Pick<NotificationsClient, 'mintRecipientToken'>
  log: (message: string, fields: Record<string, unknown>) => void
}

const defaults: NotificationsTokenDeps = {
  requireUser: (request) => requireDashboardUser(request, 'Sign in to see notifications'),
  settings: getNotificationsPluginSettings,
  createClient: createNotificationsClient,
  log: (message, fields) => getRequestLogger().error(message, fields),
}

// Used when the upstream gives no Retry-After: long enough that a retry storm cannot start, short enough to recover soon.
const DEFAULT_RETRY_AFTER_MS = 15_000

// The admin bell's browser credential: a recipient token for the signed-in admin, minted with the API key, which
// never leaves the server. A failed mint is an error, not a signed-out visitor. The browser gets a code: a permanent
// one (wrong app or API key) stops the bell, a transient one carries Retry-After. The upstream detail stays in the log.
export async function notificationsTokenData(
  request: Request,
  deps: NotificationsTokenDeps = defaults,
  call: { requestId?: string } = {},
): Promise<Response> {
  const userId = await deps.requireUser(request)
  const settings = deps.settings()
  if (!settings.enabled || !settings.baseUrl || !settings.appKey || !settings.apiKey) {
    return ok({ token: null, expiresAt: null })
  }
  try {
    const client = deps.createClient({
      baseUrl: settings.baseUrl,
      appKey: settings.appKey,
      apiKey: settings.apiKey,
      requestId: call.requestId,
    })
    const minted = await client.mintRecipientToken(userId)
    return ok({ token: minted.token, expiresAt: minted.expiresAt })
  } catch (error) {
    const upstream = error instanceof ApiError ? error : undefined
    deps.log('notifications.token.mint_failed', {
      code: upstream?.code,
      status: upstream?.status,
      retryable: upstream?.retryable,
      requestId: upstream?.requestId,
      errorName: error instanceof Error ? error.name : undefined,
    })
    if (upstream && !upstream.retryable) {
      throw new HttpError(
        ErrorCode.NOTIFICATIONS_NOT_CONFIGURED.status,
        ErrorCode.NOTIFICATIONS_NOT_CONFIGURED.code,
        ErrorCode.NOTIFICATIONS_NOT_CONFIGURED.message,
        { expose: true },
      )
    }
    const retryAfterSeconds = Math.ceil((upstream?.retryAfterMs ?? DEFAULT_RETRY_AFTER_MS) / 1000)
    throw new HttpError(
      ErrorCode.NOTIFICATIONS_UNAVAILABLE.status,
      ErrorCode.NOTIFICATIONS_UNAVAILABLE.code,
      ErrorCode.NOTIFICATIONS_UNAVAILABLE.message,
      { expose: true, headers: { 'retry-after': String(retryAfterSeconds) } },
    )
  }
}
