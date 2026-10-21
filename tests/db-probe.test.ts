import { describe, expect, test } from 'bun:test'

import { createBunSqlDbProbe } from '@/server/modules/health/infrastructure/db-probe'

describe('createBunSqlDbProbe', () => {
  test('resolving client yields ok with numeric latency', async () => {
    const probe = createBunSqlDbProbe({ unsafe: async () => [{ '?column?': 1 }] })

    const state = await probe()

    expect(state.ok).toBe(true)
    expect(typeof state.latencyMs).toBe('number')
  })

  test('rejecting client yields not-ok without throwing', async () => {
    const probe = createBunSqlDbProbe({
      unsafe: async () => Promise.reject(new Error('connection refused')),
    })

    const state = await probe()

    expect(state).toEqual({ ok: false, latencyMs: expect.any(Number) })
  })
  test('hanging client yields not-ok after the timeout', async () => {
    const { promise } = Promise.withResolvers<unknown>()
    const probe = createBunSqlDbProbe({ unsafe: () => promise })

    const state = await probe()

    expect(state.ok).toBe(false)
  }, 5000)
})
