import { describe, expect, test } from 'bun:test'

import {
  permissionsToScopes,
  scopesToPermissions,
  toPluginKey,
} from '@/server/modules/api-keys/infrastructure/api-key-repository'

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
        // The adapter round-trips metadata through JSON strings.
        metadata: JSON.stringify({ siteKey: 'demo' }),
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
      metadata: { siteKey: 'demo' },
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
      metadata: null,
      permissions: null,
    })
    expect(shaped.metadata).toBeNull()
    expect(shaped.permissions).toBeNull()
    expect(shaped.enabled).toBe(true)
  })
})
