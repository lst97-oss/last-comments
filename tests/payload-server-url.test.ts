import { describe, expect, test } from 'bun:test'

import { PayloadServerUrlError, resolvePayloadServerUrl } from '@/server/security/payload-server-url'
import type { ServerEnv } from '@/server/env'

function env(overrides: Partial<ServerEnv> = {}): ServerEnv {
  return {
    NODE_ENV: 'development',
    PAYLOAD_SECRET: 'secret',
    DATABASE_URL: 'postgres://demo:demo@127.0.0.1:5434/demo',
    PAYLOAD_PUBLIC_SERVER_URL: 'http://localhost:3000',
    ...overrides,
  }
}

describe('resolvePayloadServerUrl', () => {
  test('returns the origin, stripping paths', () => {
    expect(resolvePayloadServerUrl(env({ PAYLOAD_PUBLIC_SERVER_URL: 'http://localhost:3000/admin' }))).toBe(
      'http://localhost:3000',
    )
  })

  test('loopback is allowed in development', () => {
    expect(resolvePayloadServerUrl(env())).toBe('http://localhost:3000')
  })

  test('loopback is rejected in production', () => {
    expect(() => resolvePayloadServerUrl(env({ NODE_ENV: 'production' }))).toThrow(PayloadServerUrlError)
  })

  test('public https origin is allowed in production', () => {
    expect(
      resolvePayloadServerUrl(env({ NODE_ENV: 'production', PAYLOAD_PUBLIC_SERVER_URL: 'https://example.com' })),
    ).toBe('https://example.com')
  })

  test('invalid URL throws', () => {
    expect(() => resolvePayloadServerUrl(env({ PAYLOAD_PUBLIC_SERVER_URL: 'not-a-url' }))).toThrow(
      PayloadServerUrlError,
    )
  })

  test('missing value throws', () => {
    expect(() => resolvePayloadServerUrl(env({ PAYLOAD_PUBLIC_SERVER_URL: '' }))).toThrow(PayloadServerUrlError)
  })
})
