import { describe, expect, test } from 'bun:test'

import { destroyCachedPayloads, drainAll } from '@/plugins/payload-shutdown'

// Exercises the shipped drain against a fake globalThis._payload cache.
// Signal traps and the Nitro `close` hook are wiring, covered by the live
// SIGTERM proof (exit 0), not unit-testable here.
function setPayloadCache(entries: [string, unknown][] | undefined) {
  if (entries === undefined) {
    delete (globalThis as Record<string, unknown>)._payload
  } else {
    ;(globalThis as Record<string, unknown>)._payload = new Map(entries)
  }
}

describe('destroyCachedPayloads', () => {
  test('destroys every cached instance', async () => {
    const destroyed: string[] = []
    setPayloadCache([
      ['a', { destroy: async () => void destroyed.push('a') }],
      ['b', { destroy: async () => void destroyed.push('b') }],
    ])
    try {
      const results = await destroyCachedPayloads()
      expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
      expect(destroyed.sort()).toEqual(['a', 'b'])
    } finally {
      setPayloadCache(undefined)
    }
  })

  test('tolerates missing cache and failing destroy', async () => {
    setPayloadCache(undefined)
    expect(await destroyCachedPayloads()).toEqual([])

    setPayloadCache([
      ['broken', { destroy: async () => Promise.reject(new Error('pool gone')) }],
      ['fine', { destroy: async () => {} }],
    ])
    try {
      const results = await destroyCachedPayloads()
      expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected'])
    } finally {
      setPayloadCache(undefined)
    }
  })
})

describe('drainAll', () => {
  test('drains payload cache and business pool together', async () => {
    setPayloadCache(undefined)
    // Inject the closer: the real one would shut the shared pool other test
    // files are still using.
    const results = await drainAll(async () => {})
    expect(results).toHaveLength(2)
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
  })
})
