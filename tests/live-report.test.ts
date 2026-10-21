import { describe, expect, test } from 'bun:test'

import { buildLiveReport } from '@/server/modules/health/domain/health'

describe('buildLiveReport', () => {
  test('always live with timestamp and uptime passthrough', () => {
    const now = new Date('2026-10-12T00:00:00.000Z')
    expect(buildLiveReport({ now, uptimeSeconds: 42 })).toEqual({
      status: 'live',
      timestamp: '2026-10-12T00:00:00.000Z',
      uptimeSeconds: 42,
    })
  })
})
