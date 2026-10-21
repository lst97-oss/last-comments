import { describe, expect, test } from 'bun:test'

import { getHealth } from '@/server/modules/health/application/get-health'

const now = () => new Date('2026-10-12T00:00:00.000Z')
const uptimeSeconds = () => 90

describe('getHealth', () => {
  test('ok probe yields ok report with injected time passthrough', async () => {
    const report = await getHealth({ dbProbe: async () => ({ ok: true, latencyMs: 5 }), now, uptimeSeconds })

    expect(report).toEqual({
      status: 'ok',
      timestamp: '2026-10-12T00:00:00.000Z',
      uptimeSeconds: 90,
      checks: { database: { ok: true, latencyMs: 5 } },
    })
  })

  test('failing probe yields degraded report', async () => {
    const report = await getHealth({ dbProbe: async () => ({ ok: false, latencyMs: 2000 }), now, uptimeSeconds })

    expect(report.status).toBe('degraded')
    expect(report.timestamp).toBe('2026-10-12T00:00:00.000Z')
    expect(report.uptimeSeconds).toBe(90)
  })
})
