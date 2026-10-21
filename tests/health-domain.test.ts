import { describe, expect, test } from 'bun:test'

import { buildHealthReport } from '@/server/modules/health/domain/health'

describe('buildHealthReport', () => {
  test('all-ok check yields ok status with timestamp passthrough', () => {
    const now = new Date('2026-10-12T00:00:00.000Z')
    const report = buildHealthReport({ database: { ok: true, latencyMs: 3 }, now, uptimeSeconds: 42 })

    expect(report).toEqual({
      status: 'ok',
      timestamp: '2026-10-12T00:00:00.000Z',
      uptimeSeconds: 42,
      checks: { database: { ok: true, latencyMs: 3 } },
    })
  })

  test('failing database check yields degraded status', () => {
    const now = new Date('2026-10-12T00:00:01.000Z')
    const report = buildHealthReport({ database: { ok: false, latencyMs: 2000 }, now, uptimeSeconds: 7 })

    expect(report.status).toBe('degraded')
    expect(report.timestamp).toBe('2026-10-12T00:00:01.000Z')
    expect(report.uptimeSeconds).toBe(7)
  })

  test('uptime is passed through unchanged', () => {
    const now = new Date('2026-10-12T00:00:02.000Z')
    const report = buildHealthReport({ database: { ok: true, latencyMs: 1 }, now, uptimeSeconds: 0 })

    expect(report.uptimeSeconds).toBe(0)
  })
})
