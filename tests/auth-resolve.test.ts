import { describe, expect, test } from 'bun:test'

import { getSessionAdapters } from '@/server/auth/resolve'

describe('getSessionAdapters', () => {
  test('defaults to the built-in provider only', () => {
    expect(getSessionAdapters().map((adapter) => adapter.name)).toEqual(['better-auth'])
  })

  test('preserves file order for chained logins', () => {
    expect(getSessionAdapters({ providers: ['oidc-jwt', 'header'] }).map((adapter) => adapter.name)).toEqual([
      'oidc-jwt',
      'header',
    ])
  })
})
