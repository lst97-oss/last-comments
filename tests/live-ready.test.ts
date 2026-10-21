import { describe, expect, test } from 'bun:test'

import { getLiveData, getReadyData, handleReadyGet } from '@/server/modules/health/http/health-handler'

const now = () => new Date('2026-10-12T00:00:00.000Z')
const uptimeSeconds = () => 90

describe('liveness', () => {
  test('getLiveData never touches the database', async () => {
    expect(await getLiveData({ now, uptimeSeconds })).toEqual({
      status: 'live',
      timestamp: '2026-10-12T00:00:00.000Z',
      uptimeSeconds: 90,
    })
  })
})

describe('readiness', () => {
  test('ok probe yields 200', async () => {
    const res = await handleReadyGet({ dbProbe: async () => ({ ok: true, latencyMs: 4 }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('ok')
    expect(body.data.checks).toEqual({ database: { ok: true, latencyMs: 4 } })
  })

  test('failing probe yields 503 degraded', async () => {
    const res = await handleReadyGet({ dbProbe: async () => ({ ok: false, latencyMs: 2000 }) })
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.data.status).toBe('degraded')
  })

  test('getReadyData returns the unwrapped report', async () => {
    const report = await getReadyData({ dbProbe: async () => ({ ok: true, latencyMs: 1 }) })
    expect(report.status).toBe('ok')
  })
})
