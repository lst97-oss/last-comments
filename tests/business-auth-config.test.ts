import { describe, expect, test } from 'bun:test'

import { getBusinessAuthSettings } from '@/server/auth/business-auth-config'

const linkingPolicy = {
  accountLinking: { enabled: true, trustedProviders: ['google'], requireLocalEmailVerified: false },
}

describe('getBusinessAuthSettings', () => {
  test('allows admin password sign-in but disables public password sign-up', () => {
    expect(
      getBusinessAuthSettings({
        BETTER_AUTH_URL: 'http://localhost:3000',
        BETTER_AUTH_SECRET: 'a'.repeat(32),
        GOOGLE_CLIENT_ID: 'google-client',
        GOOGLE_CLIENT_SECRET: 'google-secret',
      }),
    ).toEqual({
      baseURL: 'http://localhost:3000',
      secret: 'a'.repeat(32),
      emailAndPassword: { enabled: true, disableSignUp: true },
      account: linkingPolicy,
      socialProviders: {
        google: { clientId: 'google-client', clientSecret: 'google-secret' },
      },
    })
  })

  test('links Google sign-ins to an existing account even when its local email is unverified', () => {
    // The first admin signs up with email/password, so the local row is unverified.
    // Without this, Google sign-in fails with account_not_linked.
    expect(
      getBusinessAuthSettings({
        BETTER_AUTH_URL: 'https://last-comments.lst97.dev',
        BETTER_AUTH_SECRET: 'a'.repeat(32),
        GOOGLE_CLIENT_ID: 'google-client',
        GOOGLE_CLIENT_SECRET: 'google-secret',
      }).account,
    ).toEqual({
      accountLinking: { enabled: true, trustedProviders: ['google'], requireLocalEmailVerified: false },
    })
  })

  test('allows auth initialization without Google OAuth credentials', () => {
    expect(
      getBusinessAuthSettings({
        BETTER_AUTH_URL: 'http://localhost:3000',
        BETTER_AUTH_SECRET: 'a'.repeat(32),
        GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_SECRET: '',
      }),
    ).toEqual({
      baseURL: 'http://localhost:3000',
      secret: 'a'.repeat(32),
      emailAndPassword: { enabled: true, disableSignUp: true },
      account: linkingPolicy,
    })
  })

  test('requires Google OAuth credentials to be configured together', () => {
    expect(() =>
      getBusinessAuthSettings({
        BETTER_AUTH_URL: 'http://localhost:3000',
        BETTER_AUTH_SECRET: 'a'.repeat(32),
        GOOGLE_CLIENT_ID: 'google-client',
        GOOGLE_CLIENT_SECRET: '',
      }),
    ).toThrow()
  })

  test('allows password sign-up only for the unmounted setup auth instance', () => {
    expect(
      getBusinessAuthSettings(
        {
          BETTER_AUTH_URL: 'http://localhost:3000',
          BETTER_AUTH_SECRET: 'a'.repeat(32),
          GOOGLE_CLIENT_ID: 'google-client',
          GOOGLE_CLIENT_SECRET: 'google-secret',
        },
        true,
      ).emailAndPassword,
    ).toEqual({ enabled: true, disableSignUp: false })
  })
})

describe('getBusinessAuthSettings production secrets', () => {
  test('refuses a placeholder or short secret when NODE_ENV is production', () => {
    const base = { BETTER_AUTH_URL: 'https://comments.example', NODE_ENV: 'production' }
    expect(() =>
      getBusinessAuthSettings({ ...base, BETTER_AUTH_SECRET: 'local-compose-better-auth-secret-change-me-32-chars' }),
    ).toThrow()
    expect(() => getBusinessAuthSettings({ ...base, BETTER_AUTH_SECRET: 'x'.repeat(31) })).toThrow()
    expect(getBusinessAuthSettings({ ...base, BETTER_AUTH_SECRET: 'k7Qp2mZ9xR4vT8wL1nB6cY3hJ5sD0fGq8' }).secret).toBe(
      'k7Qp2mZ9xR4vT8wL1nB6cY3hJ5sD0fGq8',
    )
  })

  test('still accepts the test fixture secret outside production', () => {
    expect(
      getBusinessAuthSettings({
        BETTER_AUTH_URL: 'http://localhost:3000',
        BETTER_AUTH_SECRET: 'local-compose-better-auth-secret-change-me-32-chars',
        NODE_ENV: 'development',
      }).secret,
    ).toBe('local-compose-better-auth-secret-change-me-32-chars')
  })
})
