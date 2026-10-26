import { describe, expect, test } from 'bun:test'

import {
  API_KEY_FEATURES,
  type ApiKeyFeature,
  DEFAULT_API_KEY_EXPIRY,
  DEFAULT_API_KEY_SCOPES,
  expiresInFor,
  featureOn,
  requiredCommentScopes,
  SCOPE_GROUPS,
  SITE_BOUND_SCOPES,
  scopesForSite,
  toggleFeatureIn,
} from '@/lib/api-keys'

function feature(id: string): ApiKeyFeature {
  const found = API_KEY_FEATURES.find((item) => item.id === id)
  if (!found) throw new Error(`Unknown feature ${id}`)
  return found
}

describe('comment scopes follow the site', () => {
  test('an open site needs no comment scope, because anonymous visitors already read and post', () => {
    expect(requiredCommentScopes({ access: 'open', gatewayOnly: false })).toEqual([])
    expect(requiredCommentScopes({})).toEqual([])
  })

  test('sign-in-to-post needs only the write scope', () => {
    expect(requiredCommentScopes({ access: 'login' })).toEqual(['comments:write'])
  })

  test('a private site needs both comment scopes', () => {
    expect(requiredCommentScopes({ access: 'private' })).toEqual(['comments:read', 'comments:write'])
  })

  test('a gateway-only site needs both comment scopes, whatever its access', () => {
    expect(requiredCommentScopes({ access: 'open', gatewayOnly: true })).toEqual(['comments:read', 'comments:write'])
  })

  test('choosing a site replaces the comment scopes and keeps the page scopes', () => {
    expect(scopesForSite(['pages:read', 'comments:read'], { access: 'login' })).toEqual([
      'comments:write',
      'pages:read',
    ])
  })
})

describe('API key features', () => {
  test('every site-bound scope is granted by exactly one feature', () => {
    const granted = API_KEY_FEATURES.flatMap((item) => item.scopes)
    expect([...granted].sort()).toEqual([...SITE_BOUND_SCOPES].sort())
  })

  test('ticking a feature grants its scopes and unticking it leaves the rest alone', () => {
    const post = feature('post-comments')
    const granted = toggleFeatureIn(DEFAULT_API_KEY_SCOPES, post)

    expect(featureOn(granted, post)).toBe(true)
    expect(granted).toEqual([...DEFAULT_API_KEY_SCOPES, 'comments:write'])
    expect(toggleFeatureIn(granted, post)).toEqual(DEFAULT_API_KEY_SCOPES)
  })

  test('the default key ticks the read-pages and register-pages features', () => {
    const on = API_KEY_FEATURES.filter((item) => featureOn(DEFAULT_API_KEY_SCOPES, item)).map((item) => item.id)
    expect(on).toEqual(['read-pages', 'register-pages'])
  })

  test('scope groups separate comments from pages and cover every scope once', () => {
    expect(SCOPE_GROUPS.map((group) => group.resource)).toEqual(['comments', 'pages'])
    expect(SCOPE_GROUPS.flatMap((group) => group.scopes).sort()).toEqual([...SITE_BOUND_SCOPES].sort())
  })

  test('the expiry choice is sent as seconds, and "never" sends no expiry at all', () => {
    expect(DEFAULT_API_KEY_EXPIRY).toBe('31536000')
    expect(expiresInFor(DEFAULT_API_KEY_EXPIRY)).toBe(365 * 24 * 60 * 60)
    expect(expiresInFor('7776000')).toBe(90 * 24 * 60 * 60)
    expect(expiresInFor('never')).toBeUndefined()
  })
})
