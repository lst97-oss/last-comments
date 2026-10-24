import { describe, expect, test } from 'bun:test'

import { createRegisteredOrigins } from '@/server/auth/registered-origins'

function fakeClock(start = 0) {
  let current = start
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms
    },
  }
}

describe('createRegisteredOrigins', () => {
  test('reads the source once and serves the snapshot within the TTL', async () => {
    const clock = fakeClock()
    let reads = 0
    const registry = createRegisteredOrigins(
      async () => {
        reads += 1
        return ['https://www.lst97.dev']
      },
      { ttlMs: 30_000, now: clock.now },
    )

    expect(await registry.has('https://www.lst97.dev')).toBe(true)
    clock.advance(29_999)
    expect(await registry.has('https://www.lst97.dev')).toBe(true)
    expect(reads).toBe(1)
  })

  test('re-reads the source once the TTL has passed, so a new site is picked up without a restart', async () => {
    const clock = fakeClock()
    let origins = ['https://www.lst97.dev']
    const registry = createRegisteredOrigins(async () => origins, { ttlMs: 30_000, now: clock.now })

    expect(await registry.has('https://blog.example')).toBe(false)
    origins = ['https://www.lst97.dev', 'https://blog.example']
    clock.advance(30_000)
    expect(await registry.has('https://blog.example')).toBe(true)
  })

  test('matches the exact origin only: no subdomain, scheme or port widening', async () => {
    const registry = createRegisteredOrigins(async () => ['https://www.lst97.dev'], { now: () => 0 })

    expect(await registry.has('https://www.lst97.dev')).toBe(true)
    expect(await registry.has('https://lst97.dev')).toBe(false)
    expect(await registry.has('http://www.lst97.dev')).toBe(false)
    expect(await registry.has('https://www.lst97.dev:8443')).toBe(false)
    expect(await registry.has('https://www.lst97.dev.evil.example')).toBe(false)
  })

  test('a failed first read trusts nothing and retries on the next call', async () => {
    let attempts = 0
    const errors: unknown[] = []
    const registry = createRegisteredOrigins(
      async () => {
        attempts += 1
        if (attempts === 1) throw new Error('database unavailable')
        return ['https://www.lst97.dev']
      },
      { now: () => 0, onError: (error) => errors.push(error) },
    )

    expect(await registry.has('https://www.lst97.dev')).toBe(false)
    expect(errors).toHaveLength(1)
    expect(await registry.has('https://www.lst97.dev')).toBe(true)
    expect(attempts).toBe(2)
  })

  test('a failed refresh keeps the last good snapshot instead of widening or emptying trust', async () => {
    const clock = fakeClock()
    let fail = false
    const registry = createRegisteredOrigins(
      async () => {
        if (fail) throw new Error('database unavailable')
        return ['https://www.lst97.dev']
      },
      { ttlMs: 1_000, now: clock.now, onError: () => {} },
    )

    expect(await registry.has('https://www.lst97.dev')).toBe(true)
    fail = true
    clock.advance(1_000)
    expect(await registry.has('https://www.lst97.dev')).toBe(true)
    expect(await registry.has('https://other.example')).toBe(false)
  })

  test('concurrent callers share one in-flight read', async () => {
    let reads = 0
    const registry = createRegisteredOrigins(
      async () => {
        reads += 1
        await Promise.resolve()
        return ['https://www.lst97.dev']
      },
      { now: () => 0 },
    )

    const results = await Promise.all([
      registry.has('https://www.lst97.dev'),
      registry.has('https://www.lst97.dev'),
      registry.has('https://www.lst97.dev'),
    ])
    expect(results).toEqual([true, true, true])
    expect(reads).toBe(1)
  })
})
