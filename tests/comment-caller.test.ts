import { describe, expect, test } from 'bun:test'

import type { SessionPrincipal } from '@/server/auth/principal'
import { HttpError } from '@/server/http/errors'
import { type CallerDeps, resolveCommentCaller } from '@/server/modules/comments/http/comment-caller'

const visitor: SessionPrincipal = {
  userId: 'user-1',
  email: null,
  displayName: 'Ada',
  credential: { kind: 'session', provider: 'better-auth' },
  image: null,
}

// Every port is a fake, so each test states exactly what the site and the
// request look like and asserts which checks were reached, in order.
function fakeDeps(overrides: Partial<CallerDeps> = {}) {
  const calls: string[] = []
  const deps: CallerDeps = {
    hasKey: () => false,
    requireKey: async (_request, scope, siteKey) => {
      calls.push(`requireKey:${scope}:${siteKey}`)
      return { id: 'key-1' }
    },
    siteContext: async (_siteKey, origin) => {
      calls.push('siteContext')
      return { access: 'open', gatewayOnly: false, originRegistered: origin !== null }
    },
    resolveSession: async () => {
      calls.push('resolveSession')
      return null
    },
    ...overrides,
  }
  return { deps, calls }
}

const site = 'lst97-dev'
const pageRequest = (headers: Record<string, string> = {}) =>
  new Request('https://comments.example/api/comments', { headers })

async function rejection(promise: Promise<unknown>): Promise<HttpError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof HttpError) return error
    throw error
  }
  throw new Error('expected a rejection')
}

describe('resolveCommentCaller: service keys', () => {
  test('checks the read scope for a read and the write scope for a write, bound to the site', async () => {
    const { deps, calls } = fakeDeps({ hasKey: () => true })
    await resolveCommentCaller(pageRequest({ 'x-api-key': 'lck_test' }), site, 'read', deps)
    await resolveCommentCaller(pageRequest({ 'x-api-key': 'lck_test' }), site, 'write', deps)
    expect(calls).toEqual([`requireKey:comments:read:${site}`, `requireKey:comments:write:${site}`])
  })

  test('a key caller acts for no user and gets no CORS echo, and skips the site, Origin and session work', async () => {
    const { deps, calls } = fakeDeps({ hasKey: () => true })
    const caller = await resolveCommentCaller(pageRequest({ 'x-api-key': 'lck_test' }), site, 'write', deps)
    expect(caller).toEqual({ principal: null, responseOrigin: null, keyId: 'key-1' })
    expect(calls).not.toContain('siteContext')
    expect(calls).not.toContain('resolveSession')
  })

  test('honours a well-formed x-lc-client as the visitor identity', async () => {
    const { deps } = fakeDeps({ hasKey: () => true })
    const caller = await resolveCommentCaller(
      pageRequest({ 'x-api-key': 'lck_test', 'x-lc-client': 'visitor-abcdefgh12345678' }),
      site,
      'write',
      deps,
    )
    expect(caller.clientId).toBe('visitor-abcdefgh12345678')
  })

  test('names the verified key so a call without a clientId is still bucketed', async () => {
    const { deps } = fakeDeps({ hasKey: () => true })
    const caller = await resolveCommentCaller(pageRequest({ 'x-api-key': 'lck_test' }), site, 'write', deps)
    expect(caller.keyId).toBe('key-1')
    expect(caller.clientId).toBeUndefined()
  })

  test('ignores a malformed x-lc-client rather than trusting it', async () => {
    const { deps } = fakeDeps({ hasKey: () => true })
    const caller = await resolveCommentCaller(
      pageRequest({ 'x-api-key': 'lck_test', 'x-lc-client': 'short' }),
      site,
      'write',
      deps,
    )
    expect(caller.clientId).toBeUndefined()
  })

  test('propagates a scope or binding refusal from the key check', async () => {
    const { deps } = fakeDeps({
      hasKey: () => true,
      requireKey: async () => {
        throw new HttpError(403, 'INSUFFICIENT_SCOPE', 'API key lacks the required permission')
      },
    })
    const error = await rejection(resolveCommentCaller(pageRequest({ 'x-api-key': 'lck_test' }), site, 'read', deps))
    expect(error).toMatchObject({ status: 403, code: 'INSUFFICIENT_SCOPE' })
  })
})

describe('resolveCommentCaller: gateway-only sites', () => {
  const gated = {
    siteContext: async () => ({ access: 'open' as const, gatewayOnly: true, originRegistered: true }),
  }

  test('refuse a keyless caller even with a registered Origin', async () => {
    const { deps, calls } = fakeDeps({ ...gated })
    const error = await rejection(
      resolveCommentCaller(pageRequest({ origin: 'https://lst97.dev' }), site, 'write', deps),
    )
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN' })
    // The gate is read once, then refused before any session work, so a header cannot get past it.
    expect(calls).toEqual([])
  })

  test('refuse a keyless read too', async () => {
    const { deps } = fakeDeps({ ...gated })
    const error = await rejection(resolveCommentCaller(pageRequest(), site, 'read', deps))
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  test('still accept a site-bound key', async () => {
    const { deps } = fakeDeps({ ...gated, hasKey: () => true })
    const caller = await resolveCommentCaller(pageRequest({ 'x-api-key': 'lck_test' }), site, 'write', deps)
    expect(caller.principal).toBeNull()
  })
})

describe('resolveCommentCaller: visitor policy', () => {
  test('a read tolerates a missing Origin and resolves no session without a cookie', async () => {
    const { deps, calls } = fakeDeps()
    const caller = await resolveCommentCaller(pageRequest(), site, 'read', deps)
    expect(caller).toEqual({ principal: null, responseOrigin: null })
    expect(calls).toEqual(['siteContext'])
  })

  test('a read with a cookie resolves the signed-in visitor', async () => {
    const { deps } = fakeDeps({ resolveSession: async () => visitor })
    const caller = await resolveCommentCaller(pageRequest({ cookie: 'session=1' }), site, 'read', deps)
    expect(caller.principal).toEqual(visitor)
  })

  test('a write always resolves the session and requires a registered Origin', async () => {
    const { deps, calls } = fakeDeps({
      resolveSession: async () => {
        calls.push('resolveSession')
        return visitor
      },
    })
    const caller = await resolveCommentCaller(pageRequest({ origin: 'https://lst97.dev' }), site, 'write', deps)
    expect(calls).toEqual(['siteContext', 'resolveSession'])
    expect(caller.principal).toEqual(visitor)
    expect(caller.responseOrigin).toBe('https://lst97.dev')
  })

  test('an open site admits an anonymous write', async () => {
    const { deps } = fakeDeps()
    const caller = await resolveCommentCaller(pageRequest({ origin: 'https://lst97.dev' }), site, 'write', deps)
    expect(caller.principal).toBeNull()
  })

  test('a login site admits an anonymous read but refuses an anonymous write with UNAUTHENTICATED', async () => {
    const login = {
      siteContext: async () => ({ access: 'login' as const, gatewayOnly: false, originRegistered: true }),
    }
    const { deps } = fakeDeps(login)
    await expect(resolveCommentCaller(pageRequest(), site, 'read', deps)).resolves.toMatchObject({ principal: null })
    const error = await rejection(
      resolveCommentCaller(pageRequest({ origin: 'https://lst97.dev' }), site, 'write', deps),
    )
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' })
  })

  test('a login site admits a signed-in write', async () => {
    const { deps } = fakeDeps({
      siteContext: async () => ({ access: 'login', gatewayOnly: false, originRegistered: true }),
      resolveSession: async () => visitor,
    })
    const caller = await resolveCommentCaller(pageRequest({ origin: 'https://lst97.dev' }), site, 'write', deps)
    expect(caller.principal?.userId).toBe('user-1')
  })

  test('a private site refuses an anonymous read with UNAUTHENTICATED', async () => {
    const { deps } = fakeDeps({
      siteContext: async () => ({ access: 'private', gatewayOnly: false, originRegistered: true }),
    })
    const error = await rejection(resolveCommentCaller(pageRequest(), site, 'read', deps))
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' })
  })

  test('an unknown site keeps the open behaviour for a read without an Origin', async () => {
    const { deps } = fakeDeps({ siteContext: async () => null })
    const caller = await resolveCommentCaller(pageRequest(), site, 'read', deps)
    expect(caller.principal).toBeNull()
  })

  test('an unregistered Origin on a write is refused', async () => {
    const { deps } = fakeDeps({
      siteContext: async () => ({ access: 'open', gatewayOnly: false, originRegistered: false }),
    })
    const error = await rejection(
      resolveCommentCaller(pageRequest({ origin: 'https://evil.example' }), site, 'write', deps),
    )
    expect(error).toMatchObject({ status: 403, code: 'ORIGIN_NOT_ALLOWED' })
  })

  test('an unregistered Origin on a read is refused too, once the browser sent one', async () => {
    const { deps } = fakeDeps({
      siteContext: async () => ({ access: 'open', gatewayOnly: false, originRegistered: false }),
    })
    const error = await rejection(
      resolveCommentCaller(pageRequest({ origin: 'https://evil.example' }), site, 'read', deps),
    )
    expect(error).toMatchObject({ status: 403, code: 'ORIGIN_NOT_ALLOWED' })
  })

  test('a write without any Origin is refused, even on an open site', async () => {
    const { deps } = fakeDeps()
    const error = await rejection(resolveCommentCaller(pageRequest(), site, 'write', deps))
    expect(error).toMatchObject({ status: 403, code: 'ORIGIN_NOT_ALLOWED' })
  })

  test('a malformed Origin header is refused rather than compared', async () => {
    const { deps } = fakeDeps()
    const error = await rejection(resolveCommentCaller(pageRequest({ origin: 'not a url' }), site, 'read', deps))
    expect(error).toMatchObject({ status: 403, code: 'ORIGIN_NOT_ALLOWED' })
  })
})
