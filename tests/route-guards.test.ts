import { describe, expect, test } from 'bun:test'

import { isAllowedOrigin } from '@/server/http/route-guards'

const publicOrigin = 'https://last-comments.lst97.dev'

describe('isAllowedOrigin', () => {
  test('accepts the origin the request was made to', () => {
    expect(isAllowedOrigin('http://localhost:3000', 'http://localhost:3000/api/initial-admin', undefined)).toBe(true)
  })

  test('accepts the configured public origin when TLS ends at the ingress', () => {
    // Behind the tunnel the app sees http:// while the browser sends https://.
    expect(isAllowedOrigin(publicOrigin, 'http://last-comments.lst97.dev/api/initial-admin', publicOrigin)).toBe(true)
  })

  test('rejects a foreign origin even when a public origin is configured', () => {
    expect(
      isAllowedOrigin('https://evil.example', 'http://last-comments.lst97.dev/api/initial-admin', publicOrigin),
    ).toBe(false)
  })

  test('rejects the public host over a different scheme', () => {
    expect(
      isAllowedOrigin(
        'http://last-comments.lst97.dev',
        'https://last-comments.lst97.dev/api/initial-admin',
        publicOrigin,
      ),
    ).toBe(false)
  })

  test('rejects a missing or opaque origin', () => {
    expect(isAllowedOrigin(null, 'https://last-comments.lst97.dev/api/initial-admin', publicOrigin)).toBe(false)
    expect(isAllowedOrigin('null', 'https://last-comments.lst97.dev/api/initial-admin', publicOrigin)).toBe(false)
  })

  test('without a configured public origin only the request origin passes', () => {
    expect(isAllowedOrigin(publicOrigin, 'http://last-comments.lst97.dev/api/initial-admin', undefined)).toBe(false)
  })
})
