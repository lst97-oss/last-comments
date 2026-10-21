import { describe, expect, test } from 'bun:test'

import {
  getAuthSelection,
  getHeaderProviderSettings,
  getOidcSettings,
  isBetterAuthEnabled,
} from '@/server/auth/provider-config'

const oidcEnv = {
  AUTH_OIDC_JWKS_URL: 'https://idp.example.com/.well-known/jwks.json',
  AUTH_OIDC_ISSUER: 'https://idp.example.com/',
  AUTH_OIDC_AUDIENCE: 'last-comments',
}

describe('getAuthSelection', () => {
  test('defaults to better-auth with auto-provision on', () => {
    expect(getAuthSelection()).toEqual({ providers: ['better-auth'], autoProvision: true, bootstrapEmail: undefined })
  })

  test('reads providers, auto-provision and bootstrap email from the file', () => {
    expect(
      getAuthSelection({ providers: ['oidc-jwt'], autoProvision: false, bootstrapEmail: 'Admin@Example.com ' }),
    ).toEqual({ providers: ['oidc-jwt'], autoProvision: false, bootstrapEmail: 'admin@example.com' })
  })

  test('rejects unknown provider names instead of silently ignoring them', () => {
    expect(() => getAuthSelection({ providers: ['saml'] })).toThrow()
  })
})

describe('isBetterAuthEnabled', () => {
  test('is true by default and false for external-only instances', () => {
    expect(isBetterAuthEnabled()).toBe(true)
    expect(isBetterAuthEnabled({ providers: ['oidc-jwt'] })).toBe(false)
    expect(isBetterAuthEnabled({ providers: ['better-auth', 'oidc-jwt'] })).toBe(true)
  })
})

describe('getOidcSettings', () => {
  test('applies email-claim and clock-skew defaults, endpoints from env', () => {
    expect(getOidcSettings(undefined, oidcEnv)).toEqual({
      AUTH_OIDC_JWKS_URL: 'https://idp.example.com/.well-known/jwks.json',
      AUTH_OIDC_ISSUER: 'https://idp.example.com/',
      AUTH_OIDC_AUDIENCE: 'last-comments',
      AUTH_OIDC_EMAIL_CLAIM: 'email',
      AUTH_OIDC_CLOCK_SKEW_SECONDS: 60,
    })
  })

  test('reads claim mapping from the file', () => {
    expect(
      getOidcSettings({ oidc: { emailClaim: 'preferred_username', clockSkewSeconds: 30 } }, oidcEnv),
    ).toMatchObject({ AUTH_OIDC_EMAIL_CLAIM: 'preferred_username', AUTH_OIDC_CLOCK_SKEW_SECONDS: 30 })
  })

  test('requires jwks url, issuer, and audience from env', () => {
    expect(() => getOidcSettings(undefined, {})).toThrow()
  })
})

describe('getHeaderProviderSettings', () => {
  test('proxy trust defaults to off', () => {
    expect(getHeaderProviderSettings().AUTH_TRUST_PROXY).toBe(false)
  })

  test('reads trust and header names from the file', () => {
    expect(
      getHeaderProviderSettings({
        header: {
          trustProxy: true,
          proxyCidr: '10.0.0.0/8',
          userHeader: 'x-authentik-username',
          emailHeader: 'x-forwarded-email',
          nameHeader: 'x-forwarded-name',
        },
      }),
    ).toMatchObject({ AUTH_TRUST_PROXY: true, AUTH_PROXY_CIDR: '10.0.0.0/8', AUTH_HEADER_USER: 'x-authentik-username' })
  })
})
