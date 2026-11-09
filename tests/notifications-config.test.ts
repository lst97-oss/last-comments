import { describe, expect, test } from 'bun:test'
import { HttpStatus } from '@lst97-oss/last-httprism'

import { ErrorCode, HttpError } from '@/server/http/errors'
import { type NotificationsConfigDeps, notificationsConfigData } from '@/server/modules/admin/http/notifications-config'
import type { ResolvedNotificationsConfig } from '@/server/plugins/notifications/notifications.config'

const ENABLED: ResolvedNotificationsConfig = {
  enabled: true,
  missing: [],
  baseUrl: 'http://notify.test',
  publicUrl: 'https://notify.example.com',
  appKey: 'app-1',
  apiKey: 'lnk_test_0123456789abcdef',
  events: { created: true, heldForReview: true, hidden: true, deleted: true, pageReacted: false },
  reactionWindowMinutes: 30,
  channels: ['inapp'],
}

const request = () => new Request('https://host.test/api/notifications-config')

function harness(
  settings: Partial<ResolvedNotificationsConfig> = {},
  requireUser?: NotificationsConfigDeps['requireUser'],
) {
  let reads = 0
  const deps: NotificationsConfigDeps = {
    requireUser: requireUser ?? (async () => 'admin-1'),
    settings: () => {
      reads += 1
      return { ...ENABLED, ...settings }
    },
  }
  return { deps, reads: () => reads }
}

describe('notificationsConfigData', () => {
  test('an admin gets the public address and app key, with no credential', async () => {
    const { deps } = harness()
    const response = await notificationsConfigData(request(), deps)
    expect(response.status).toBe(HttpStatus.OK.code)
    const body = (await response.json()) as { data: Record<string, unknown> }
    expect(body.data).toEqual({ baseUrl: 'https://notify.example.com', appKey: 'app-1' })
    expect(JSON.stringify(body)).not.toContain('lnk_')
  })

  test('a disabled plugin answers nulls, so the bell stays hidden', async () => {
    const { deps } = harness({ enabled: false })
    expect(await (await notificationsConfigData(request(), deps)).json()).toEqual({
      data: { baseUrl: null, appKey: null },
    })
  })

  test('a visitor who is not an admin gets no settings at all', async () => {
    const { deps, reads } = harness({}, async () => {
      throw new HttpError(ErrorCode.FORBIDDEN.status, ErrorCode.FORBIDDEN.code, ErrorCode.FORBIDDEN.message)
    })
    await expect(notificationsConfigData(request(), deps)).rejects.toMatchObject({
      status: ErrorCode.FORBIDDEN.status,
    })
    expect(reads()).toBe(0)
  })
})
