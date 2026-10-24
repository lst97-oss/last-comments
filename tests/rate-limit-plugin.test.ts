import { describe, expect, test } from 'bun:test'

import type { Logger } from '@/server/observability/logger'
import { createRateLimitPlugin, type RateLimitWindow } from '@/server/plugins/rate-limit/rate-limit.plugin'
import { getRateLimitPluginSettings } from '@/server/plugins/rate-limit/rate-limit.config'

function recordingLogger(logs: string[]): Logger {
  const logger = {} as Logger
  logger.debug = () => undefined
  logger.info = () => undefined
  logger.warn = () => undefined
  logger.error = (message) => logs.push(message)
  logger.child = () => logger
  return logger
}

describe('rate-limit plugin', () => {
  test('validates the HMAC secret length from plugin environment', () => {
    expect(() => getRateLimitPluginSettings({ BETTER_AUTH_SECRET: 'too-short' })).toThrow()
    expect(getRateLimitPluginSettings({}).secret).toBeUndefined()
  })

  test('reads the trusted ingress list from the environment', () => {
    expect(
      getRateLimitPluginSettings({ RATE_LIMIT_TRUSTED_PROXY_CIDR: '10.0.0.0/8, 192.168.0.0/16' }).trustedProxyCidrs,
    ).toEqual(['10.0.0.0/8', '192.168.0.0/16'])
    // Unset falls back to the loopback and private-network defaults.
    expect(getRateLimitPluginSettings({}).trustedProxyCidrs).toContain('127.0.0.0/8')
  })

  test('uses a keyed requester hash and rejects the first create over the configured limit', async () => {
    const previousSecret = Bun.env.BETTER_AUTH_SECRET
    Bun.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough-32'
    const windows: RateLimitWindow[] = []
    const plugin = createRateLimitPlugin(
      () => null,
      async (window) => {
        windows.push(window)
        return windows.length
      },
      undefined,
      // The instance budgets are config, not behaviour: the plugin gets its own
      // so the test never depends on the deployed map.
      {
        'comment.create': { count: 5, windowSeconds: 600 },
        'comment.edit': { count: 20, windowSeconds: 600 },
        'comment.delete': { count: 20, windowSeconds: 600 },
        'comment.vote': { count: 60, windowSeconds: 60 },
      },
    )
    const input = {
      operation: 'comment.create' as const,
      siteKey: 'docs',
      userId: 'user-1',
      request: new Request('https://comments.example/api/comments', { method: 'POST' }),
    }

    try {
      for (let attempt = 0; attempt < 5; attempt += 1)
        await plugin.beforeOperation?.(input, new AbortController().signal)
      await expect(plugin.beforeOperation?.(input, new AbortController().signal)).rejects.toMatchObject({
        status: 429,
        code: 'RATE_LIMITED',
        headers: expect.objectContaining({ 'retry-after': expect.any(String) }),
      })
      expect(windows[0]?.retentionSeconds).toBe(1200) // two of the longest (600s) window
      expect(windows[0]?.identityHash).toMatch(/^[a-f0-9]{64}$/)
      expect(windows[0]?.identityHash).not.toContain('user-1')
      expect(windows[0]?.siteKey).toBe('docs')
    } finally {
      if (previousSecret === undefined) delete Bun.env.BETTER_AUTH_SECRET
      else Bun.env.BETTER_AUTH_SECRET = previousSecret
    }
  })

  test('fails closed for guest writes when the configured IP resolver returns no address', async () => {
    let incremented = false
    const plugin = createRateLimitPlugin(
      () => null,
      async () => {
        incremented = true
        return 1
      },
    )
    await expect(
      plugin.beforeOperation?.(
        {
          operation: 'comment.create',
          siteKey: 'docs',
          userId: null,
          request: new Request('https://comments.example/api/comments', { method: 'POST' }),
        },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ status: 503, code: 'RATE_LIMIT_UNAVAILABLE' })
    expect(incremented).toBe(false)
  })

  test('logs rate-limit storage failures without logging requester identifiers', async () => {
    const previousSecret = Bun.env.BETTER_AUTH_SECRET
    Bun.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough-32'
    const logs: string[] = []
    const plugin = createRateLimitPlugin(
      () => '192.0.2.10',
      async () => {
        throw new Error('database unavailable')
      },
      recordingLogger(logs),
    )
    try {
      await expect(
        plugin.beforeOperation?.(
          {
            operation: 'comment.create',
            siteKey: 'docs',
            userId: null,
            request: new Request('https://comments.example/api/comments', { method: 'POST' }),
          },
          new AbortController().signal,
        ),
      ).rejects.toMatchObject({ status: 503, code: 'RATE_LIMIT_UNAVAILABLE' })
      expect(logs).toEqual(['rate_limit.storage_unavailable'])
    } finally {
      if (previousSecret === undefined) delete Bun.env.BETTER_AUTH_SECRET
      else Bun.env.BETTER_AUTH_SECRET = previousSecret
    }
  })

  test('a verified clientId gives each proxied visitor their own budget, ahead of the shared IP', async () => {
    const previousSecret = Bun.env.BETTER_AUTH_SECRET
    Bun.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough-32'
    const hashes: string[] = []
    const plugin = createRateLimitPlugin(
      // Every proxied call arrives from the host's own address.
      () => '198.51.100.7',
      async (window) => {
        hashes.push(window.identityHash)
        return 1
      },
      undefined,
      {
        'comment.create': { count: 5, windowSeconds: 600 },
        'comment.edit': { count: 20, windowSeconds: 600 },
        'comment.delete': { count: 20, windowSeconds: 600 },
        'comment.vote': { count: 60, windowSeconds: 60 },
      },
    )
    const request = new Request('https://comments.example/api/comments', { method: 'POST' })
    const base = { operation: 'comment.create' as const, siteKey: 'docs', userId: null, request }
    try {
      await plugin.beforeOperation?.({ ...base, clientId: 'visitor-aaaaaaaaaaaaaaaa' }, new AbortController().signal)
      await plugin.beforeOperation?.({ ...base, clientId: 'visitor-bbbbbbbbbbbbbbbb' }, new AbortController().signal)
      await plugin.beforeOperation?.({ ...base, clientId: 'visitor-aaaaaaaaaaaaaaaa' }, new AbortController().signal)
      expect(hashes[0]).not.toBe(hashes[1])
      // The same visitor keeps the same bucket across calls.
      expect(hashes[2]).toBe(hashes[0])
    } finally {
      if (previousSecret === undefined) delete Bun.env.BETTER_AUTH_SECRET
      else Bun.env.BETTER_AUTH_SECRET = previousSecret
    }
  })

  test('a key without a clientId is bucketed by the key, not refused when the IP is unknown', async () => {
    const previousSecret = Bun.env.BETTER_AUTH_SECRET
    Bun.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough-32'
    const hashes: string[] = []
    const plugin = createRateLimitPlugin(
      () => null,
      async (window) => {
        hashes.push(window.identityHash)
        return 1
      },
      undefined,
      {
        'comment.create': { count: 5, windowSeconds: 600 },
        'comment.edit': { count: 20, windowSeconds: 600 },
        'comment.delete': { count: 20, windowSeconds: 600 },
        'comment.vote': { count: 60, windowSeconds: 60 },
      },
    )
    const request = new Request('https://comments.example/api/comments', { method: 'POST' })
    const base = { operation: 'comment.create' as const, siteKey: 'docs', userId: null, request }
    try {
      await plugin.beforeOperation?.({ ...base, keyId: 'key-1' }, new AbortController().signal)
      await plugin.beforeOperation?.({ ...base, keyId: 'key-2' }, new AbortController().signal)
      expect(hashes).toHaveLength(2)
      expect(hashes[0]).not.toBe(hashes[1])
    } finally {
      if (previousSecret === undefined) delete Bun.env.BETTER_AUTH_SECRET
      else Bun.env.BETTER_AUTH_SECRET = previousSecret
    }
  })
})
