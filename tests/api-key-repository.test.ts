import { describe, expect, test } from 'bun:test'

import {
  assertValidScopeSet,
  hasServiceKey,
  permissionsToScopes,
  scopesToPermissions,
  toPluginKey,
} from '@/server/modules/api-keys/infrastructure/api-key-repository'

function requestWith(headers: Record<string, string>): Request {
  return new Request('http://localhost:3000/api/admin/sites', { headers })
}

describe('api-key storage mapping', () => {
  test('scopes round-trip through the stored permissions map', () => {
    const scopes = ['pages:read', 'pages:write'] as const
    expect(permissionsToScopes(scopesToPermissions([...scopes]))).toEqual([...scopes])
    expect(permissionsToScopes({ sites: ['create', 'read'] })).toEqual(['sites:create', 'sites:read'])
    expect(permissionsToScopes('{"pages":["read"]}')).toEqual(['pages:read'])
    expect(permissionsToScopes(null)).toEqual([])
    expect(permissionsToScopes('not-json')).toEqual([])
  })

  test('toPluginKey shapes a row like the plugin list endpoint', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z')
    expect(
      toPluginKey({
        id: 'key-1',
        name: 'publisher',
        start: 'lck_abcd',
        prefix: 'lck_',
        enabled: true,
        expiresAt: null,
        createdAt,
        // The site comes from the api_key_sites join, not from the plugin's metadata.
        siteKey: 'demo',
        permissions: JSON.stringify({ pages: ['read', 'write'] }),
      }),
    ).toEqual({
      id: 'key-1',
      name: 'publisher',
      start: 'lck_abcd',
      prefix: 'lck_',
      enabled: true,
      expiresAt: null,
      createdAt,
      metadata: { site: 'demo' },
      permissions: { pages: ['read', 'write'] },
    })
  })

  test('toPluginKey tolerates missing metadata and permissions', () => {
    const shaped = toPluginKey({
      id: 'key-2',
      name: null,
      start: null,
      prefix: null,
      enabled: null,
      expiresAt: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      siteKey: null,
      permissions: null,
    })
    expect(shaped.metadata).toBeNull()
    expect(shaped.permissions).toBeNull()
    expect(shaped.enabled).toBe(true)
  })
})

describe('service key detection', () => {
  test('an Authorization bearer is only a service key when it carries the key prefix', () => {
    expect(hasServiceKey(requestWith({ authorization: 'Bearer lck_abc123' }))).toBe(true)
    expect(hasServiceKey(requestWith({ authorization: 'lck_abc123' }))).toBe(true)
    // An identity-provider token must reach the session adapters instead.
    expect(hasServiceKey(requestWith({ authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig' }))).toBe(false)
    expect(hasServiceKey(requestWith({ authorization: 'Basic dXNlcjpwYXNz' }))).toBe(false)
  })

  test('the x-api-key header is always a service key', () => {
    expect(hasServiceKey(requestWith({ 'x-api-key': 'lck_abc123' }))).toBe(true)
    expect(hasServiceKey(requestWith({}))).toBe(false)
  })

  test('comment scopes store under the comments resource and round-trip', () => {
    const scopes = ['comments:read', 'comments:write'] as const
    expect(scopesToPermissions([...scopes])).toEqual({ comments: ['read', 'write'] })
    expect(permissionsToScopes({ comments: ['read', 'write'] })).toEqual([...scopes])
  })

  test('a site-bound key may hold the comment scopes; an instance key may not', () => {
    expect(() => assertValidScopeSet('lst97-dev', ['comments:read', 'comments:write'])).not.toThrow()
    expect(() => assertValidScopeSet('lst97-dev', ['sites:read'])).toThrow()
    expect(() => assertValidScopeSet(null, ['comments:write'])).toThrow()
  })
})
