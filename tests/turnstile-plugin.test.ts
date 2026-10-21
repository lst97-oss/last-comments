import { describe, expect, test } from 'bun:test'

import type { Logger } from '@/server/observability/logger'
import { getCommentPlugins } from '@/server/plugins/comment-plugins'
import { createTurnstilePlugin } from '@/server/plugins/turnstile/turnstile.plugin'
import { getTurnstilePluginSettings } from '@/server/plugins/turnstile/turnstile.config'

const input = {
  siteId: 'site-1',
  pageUrl: 'https://example.com/post',
  userId: null,
  authorName: 'Guest',
  bodyMarkdown: 'hello',
  verificationToken: 'turnstile-token',
}

function recordingLogger(logs: string[]): Logger {
  const logger = {} as Logger
  logger.debug = () => undefined
  logger.info = () => undefined
  logger.warn = (message) => logs.push(message)
  logger.error = () => undefined
  logger.child = () => logger
  return logger
}

describe('Turnstile plugin', () => {
  test('reads the switch and site key from the file, the secret from env', () => {
    // Hermetic inputs only: ambient .env / turnstile.config.ts carry real
    // operator values and must never leak into assertions.
    const empty = { file: { verificationRequired: true }, env: {} }
    expect(getTurnstilePluginSettings(empty)).toEqual({
      secretKey: undefined,
      verificationRequired: true,
      siteKey: undefined,
    })
    expect(getTurnstilePluginSettings({ env: { TURNSTILE_SECRET_KEY: '  ' } })).toMatchObject({ secretKey: undefined })
    expect(getTurnstilePluginSettings({ env: { TURNSTILE_SECRET_KEY: 'secret' } })).toMatchObject({
      secretKey: 'secret',
    })
    // The bypass is opt-in: only an explicit `false` skips guest verification.
    expect(getTurnstilePluginSettings({ file: { verificationRequired: false } }).verificationRequired).toBe(false)
    expect(getTurnstilePluginSettings({ file: { verificationRequired: true } }).verificationRequired).toBe(true)
    expect(getTurnstilePluginSettings({ file: { siteKey: '0x4-public' } }).siteKey).toBe('0x4-public')
  })

  test('falls back to the env site key when the file config has none', () => {
    expect(getTurnstilePluginSettings({ env: { TURNSTILE_SITE_KEY: ' 1x-test ' } }).siteKey).toBe('1x-test')
    expect(getTurnstilePluginSettings({ env: { TURNSTILE_SITE_KEY: '  ' } }).siteKey).toBeUndefined()
    // The file config is the documented home of the public key; it wins.
    expect(
      getTurnstilePluginSettings({ file: { siteKey: '0x4-public' }, env: { TURNSTILE_SITE_KEY: '1x-test' } }).siteKey,
    ).toBe('0x4-public')
  })

  test('is registered in the static plugin manifest', () => {
    expect(getCommentPlugins().some((plugin) => plugin.id === 'turnstile')).toBe(true)
  })

  test('verifies a guest token and accepts the matching hostname', async () => {
    let requestBody = ''
    const plugin = createTurnstilePlugin({
      // Pinned: the switch comes from the file config, never ambient env.
      verificationRequired: true,
      secretKey: 'secret',
      fetcher: async (url, init) => {
        expect(String(url)).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
        expect(init?.method).toBe('POST')
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        requestBody = String(init?.body)
        return Response.json({ success: true, hostname: 'example.com' })
      },
    })

    await plugin.validateComment?.(input, new AbortController().signal)

    expect(requestBody).toContain('secret=secret')
    expect(requestBody).toContain('response=turnstile-token')
  })

  test('rejects an invalid token', async () => {
    const plugin = createTurnstilePlugin({
      // Pinned: the switch comes from the file config, never ambient env.
      verificationRequired: true,
      secretKey: 'secret',
      fetcher: async () => Response.json({ success: false, hostname: 'example.com' }),
    })

    await expect(plugin.validateComment?.(input, new AbortController().signal)).rejects.toMatchObject({
      code: 'COMMENT_VERIFICATION_FAILED',
      status: 403,
    })
  })

  test('rejects a token issued for a different hostname', async () => {
    const plugin = createTurnstilePlugin({
      // Pinned: the switch comes from the file config, never ambient env.
      verificationRequired: true,
      secretKey: 'secret',
      fetcher: async () => Response.json({ success: true, hostname: 'attacker.example' }),
    })

    await expect(plugin.validateComment?.(input, new AbortController().signal)).rejects.toMatchObject({
      code: 'COMMENT_VERIFICATION_FAILED',
      status: 403,
    })
  })

  test('accepts a Cloudflare testing secret on any hostname', async () => {
    const plugin = createTurnstilePlugin({
      verificationRequired: true,
      secretKey: '1x0000000000000000000000000000000AA',
      fetcher: async () => Response.json({ success: true, hostname: 'example.com' }),
    })

    await plugin.validateComment?.(
      { ...input, pageUrl: 'http://localhost:3000/blog/hello' },
      new AbortController().signal,
    )
  })

  test('fails unavailable when the secret is missing', async () => {
    const logs: string[] = []
    const plugin = createTurnstilePlugin({
      secretKey: '',
      verificationRequired: true,
      fetcher: fetch,
      logger: recordingLogger(logs),
    })

    await expect(plugin.validateComment?.(input, new AbortController().signal)).rejects.toMatchObject({
      code: 'COMMENT_VERIFICATION_UNAVAILABLE',
      status: 503,
    })
    expect(logs).toEqual(['turnstile.unavailable'])
  })

  test('treats a whitespace-only secret as missing', async () => {
    let called = false
    const plugin = createTurnstilePlugin({
      // Pinned: the switch comes from the file config, never ambient env.
      verificationRequired: true,
      secretKey: '  ',
      fetcher: async () => {
        called = true
        return Response.json({ success: true, hostname: 'example.com' })
      },
    })

    await expect(plugin.validateComment?.(input, new AbortController().signal)).rejects.toMatchObject({
      code: 'COMMENT_VERIFICATION_UNAVAILABLE',
      status: 503,
    })
    expect(called).toBe(false)
  })

  test('fails unavailable when Siteverify cannot be reached', async () => {
    const plugin = createTurnstilePlugin({
      // Pinned: the switch comes from the file config, never ambient env.
      verificationRequired: true,
      secretKey: 'secret',
      fetcher: async () => {
        throw new TypeError('network failed')
      },
    })

    await expect(plugin.validateComment?.(input, new AbortController().signal)).rejects.toMatchObject({
      code: 'COMMENT_VERIFICATION_UNAVAILABLE',
      status: 503,
    })
  })

  test('fails unavailable when Siteverify returns an error response', async () => {
    const plugin = createTurnstilePlugin({
      // Pinned: the switch comes from the file config, never ambient env.
      verificationRequired: true,
      secretKey: 'secret',
      fetcher: async () => new Response('unavailable', { status: 503 }),
    })

    await expect(plugin.validateComment?.(input, new AbortController().signal)).rejects.toMatchObject({
      code: 'COMMENT_VERIFICATION_UNAVAILABLE',
      status: 503,
    })
  })

  test('fails unavailable when Siteverify returns a malformed success response', async () => {
    const plugin = createTurnstilePlugin({
      // Pinned: the switch comes from the file config, never ambient env.
      verificationRequired: true,
      secretKey: 'secret',
      fetcher: async () => Response.json({ success: 'true', hostname: 'example.com' }),
    })

    await expect(plugin.validateComment?.(input, new AbortController().signal)).rejects.toMatchObject({
      code: 'COMMENT_VERIFICATION_UNAVAILABLE',
      status: 503,
    })
  })

  test('skips guest verification when the host disables it', async () => {
    let called = false
    const plugin = createTurnstilePlugin({
      secretKey: undefined,
      verificationRequired: false,
      fetcher: async () => {
        called = true
        return Response.json({ success: true, hostname: 'example.com' })
      },
    })

    await expect(plugin.validateComment?.(input, new AbortController().signal)).resolves.toBeUndefined()
    expect(called).toBe(false)
  })

  test('skips verification for signed-in users', async () => {
    let called = false
    const plugin = createTurnstilePlugin({
      secretKey: '',
      verificationRequired: true,
      fetcher: async () => {
        called = true
        return Response.json({ success: true, hostname: 'example.com' })
      },
    })

    await plugin.validateComment?.(
      { ...input, userId: 'user-1', verificationToken: undefined },
      new AbortController().signal,
    )

    expect(called).toBe(false)
  })
})
