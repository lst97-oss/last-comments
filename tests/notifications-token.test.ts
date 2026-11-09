import { describe, expect, test } from 'bun:test'
import { HttpStatus } from '@lst97-oss/last-httprism'
import { ApiError } from '@lst97-oss/last-notifications-widgets/server'

import { ErrorCode } from '@/server/http/errors'
import { fail } from '@/server/http/response'
import { notificationsTokenData, type NotificationsTokenDeps } from '@/server/modules/admin/http/notifications-token'
import type { ResolvedNotificationsConfig } from '@/server/plugins/notifications/notifications.config'

const EXPIRES = '2026-11-01T12:15:00.000Z'
const ENABLED: ResolvedNotificationsConfig = {
  enabled: true,
  missing: [],
  baseUrl: 'http://notify.test',
  publicUrl: 'http://notify.test',
  appKey: 'app-1',
  apiKey: 'lnk_test_0123456789abcdef',
  events: { created: true, heldForReview: true, hidden: true, deleted: true, pageReacted: false },
  reactionWindowMinutes: 30,
  channels: ['inapp'],
}

const request = () => new Request('https://host.test/api/notifications-token')

// Fakes are injected ports: the test never touches the database, the session or the notification server.
function harness(
  options: {
    settings?: Partial<ResolvedNotificationsConfig>
    mint?: (recipientKey: string) => Promise<{ token: string; expiresAt: string }>
  } = {},
) {
  const minted: string[] = []
  const logs: { message: string; fields: Record<string, unknown> }[] = []
  const deps: NotificationsTokenDeps = {
    requireUser: async () => 'admin-1',
    settings: () => ({ ...ENABLED, ...options.settings }),
    createClient: () => ({
      mintRecipientToken: async (recipientKey) => {
        minted.push(recipientKey)
        return options.mint ? options.mint(recipientKey) : { token: 'lrt_1', expiresAt: EXPIRES }
      },
    }),
    log: (message, fields) => logs.push({ message, fields }),
  }
  return { deps, minted, logs }
}

describe('notificationsTokenData', () => {
  test('a signed-in admin gets a fresh recipient token, minted for that admin', async () => {
    const { deps, minted } = harness()
    const response = await notificationsTokenData(request(), deps)
    expect(response.status).toBe(HttpStatus.OK.code)
    expect(await response.json()).toEqual({ data: { token: 'lrt_1', expiresAt: EXPIRES } })
    expect(minted).toEqual(['admin-1'])
  })

  test('a disabled plugin answers nulls and never mints', async () => {
    const { deps, minted } = harness({ settings: { enabled: false } })
    const response = await notificationsTokenData(request(), deps)
    expect(await response.json()).toEqual({ data: { token: null, expiresAt: null } })
    expect(minted).toEqual([])
  })

  test('a failed mint is a 503 with the general message, and the upstream detail goes to the log only', async () => {
    const { deps, logs } = harness({
      mint: async () => {
        throw new ApiError(
          'INTERNAL_ERROR',
          'upstream detail that must not reach the browser',
          HttpStatus.INTERNAL_SERVER_ERROR.code,
        )
      },
    })
    const response = await notificationsTokenData(request(), deps).catch((error: unknown) => fail(error))
    expect(response.status).toBe(ErrorCode.NOTIFICATIONS_UNAVAILABLE.status)
    expect(await response.json()).toEqual({
      error: { code: 'NOTIFICATIONS_UNAVAILABLE', message: 'Notifications are temporarily unavailable.' },
    })
    expect(logs).toEqual([
      {
        message: 'notifications.token.mint_failed',
        fields: {
          code: 'INTERNAL_ERROR',
          status: HttpStatus.INTERNAL_SERVER_ERROR.code,
          retryable: true,
          errorName: 'ApiError',
        },
      },
    ])
  })

  test('a network failure to the notification server is the same 503, logged with its code', async () => {
    const { deps, logs } = harness({
      mint: async () => {
        throw new ApiError('NETWORK_ERROR', "Couldn't reach the notifications server.", 0)
      },
    })
    await expect(notificationsTokenData(request(), deps)).rejects.toMatchObject({
      status: ErrorCode.NOTIFICATIONS_UNAVAILABLE.status,
      code: 'NOTIFICATIONS_UNAVAILABLE',
    })
    expect(logs[0]?.fields.code).toBe('NETWORK_ERROR')
  })

  test('a wrong app or API key is a permanent 501, so the bell stops retrying', async () => {
    const { deps } = harness({
      mint: async () => {
        throw new ApiError('APP_NOT_FOUND', 'App was not found', HttpStatus.NOT_FOUND.code)
      },
    })
    const response = await notificationsTokenData(request(), deps).catch((error: unknown) => fail(error))
    expect(response.status).toBe(ErrorCode.NOTIFICATIONS_NOT_CONFIGURED.status)
    expect(response.headers.get('retry-after')).toBeNull()
    expect(await response.json()).toEqual({
      error: { code: 'NOTIFICATIONS_NOT_CONFIGURED', message: 'Notifications are not set up on this site.' },
    })
  })

  test('a transient failure is a 503 that carries the upstream Retry-After', async () => {
    const { deps } = harness({
      mint: async () => {
        throw new ApiError('INTERNAL_ERROR', 'busy', HttpStatus.SERVICE_UNAVAILABLE.code, { retryAfterMs: 4000 })
      },
    })
    const response = await notificationsTokenData(request(), deps).catch((error: unknown) => fail(error))
    expect(response.status).toBe(ErrorCode.NOTIFICATIONS_UNAVAILABLE.status)
    expect(response.headers.get('retry-after')).toBe('4')
  })

  test('a transient failure with no hint still tells the bell to wait, by default 15 seconds', async () => {
    const { deps } = harness({
      mint: async () => {
        throw new ApiError('NETWORK_ERROR', "Couldn't reach the notifications server.", 0)
      },
    })
    const response = await notificationsTokenData(request(), deps).catch((error: unknown) => fail(error))
    expect(response.headers.get('retry-after')).toBe('15')
  })

  test('the browser call request id reaches the notification server, so both logs share one id', async () => {
    const { deps } = harness()
    let sentWith: string | undefined
    await notificationsTokenData(
      request(),
      {
        ...deps,
        createClient: (options) => {
          sentWith = options.requestId
          return { mintRecipientToken: async () => ({ token: 'lrt_1', expiresAt: EXPIRES }) }
        },
      },
      { requestId: 'req-7' },
    )
    expect(sentWith).toBe('req-7')
  })
})
