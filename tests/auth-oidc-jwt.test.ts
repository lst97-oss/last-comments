import { describe, expect, test } from 'bun:test'

import { clearOidcCache, resolveOidcSession, verifyOidcJwt } from '@/server/auth/oidc-jwt'
import type { OidcSettings } from '@/server/auth/provider-config'

const settings: OidcSettings = {
  AUTH_OIDC_JWKS_URL: 'https://idp.example.com/.well-known/jwks.json',
  AUTH_OIDC_ISSUER: 'https://idp.example.com/',
  AUTH_OIDC_AUDIENCE: 'last-comments',
  AUTH_OIDC_EMAIL_CLAIM: 'email',
  AUTH_OIDC_CLOCK_SKEW_SECONDS: 60,
}

function encodePart(value: unknown): string {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')
}

async function signJwt(
  privateKey: CryptoKey,
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
): Promise<string> {
  const signingInput = `${encodePart(header)}.${encodePart(payload)}`
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(signingInput))
  return `${signingInput}.${Buffer.from(signature).toString('base64url')}`
}

async function setupKey() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )
  const publicJwk = (await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as JsonWebKey & { kid?: string }
  publicJwk.kid = 'key-1'
  publicJwk.alg = 'RS256'
  return { privateKey: keyPair.privateKey, jwks: { keys: [publicJwk] } }
}

function claims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const nowSeconds = Math.floor(Date.now() / 1000)
  return {
    iss: 'https://idp.example.com/',
    aud: 'last-comments',
    sub: 'user-123',
    exp: nowSeconds + 3600,
    iat: nowSeconds,
    email: 'sso@example.com',
    email_verified: true,
    name: 'SSO User',
    ...overrides,
  }
}

// Minimal drizzle stub: queued select() results, insert() records rows.
function stubDb(selectQueue: unknown[][] = [], inserted: { table: string; values: unknown }[] = []) {
  const chain = (rows: unknown[]) => ({
    from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }), limit: () => Promise.resolve(rows) }),
  })
  return {
    inserted,
    select: () => chain((selectQueue.shift() ?? []) as unknown[]),
    insert: (table: { _: unknown } | unknown) => ({
      values: (values: unknown) => {
        inserted.push({
          table: typeof table === 'object' && table !== null && 'id' in table ? 'table' : 'table',
          values,
        })
        return {
          returning: () => Promise.resolve([{ id: 'new-user-id', email: 'sso@example.com', name: 'SSO User' }]),
          onConflictDoNothing: () => Promise.resolve(),
        }
      },
    }),
  }
}

describe('verifyOidcJwt', () => {
  test('accepts a valid RS256 token', async () => {
    const { privateKey, jwks } = await setupKey()
    const token = await signJwt(privateKey, { alg: 'RS256', kid: 'key-1', typ: 'JWT' }, claims())
    await expect(verifyOidcJwt(token, jwks, settings)).resolves.toMatchObject({
      sub: 'user-123',
      email: 'sso@example.com',
      emailVerified: true,
      name: 'SSO User',
    })
  })

  test('rejects wrong issuer, audience, and expired tokens', async () => {
    const { privateKey, jwks } = await setupKey()
    const badIssuer = await signJwt(
      privateKey,
      { alg: 'RS256', kid: 'key-1' },
      claims({ iss: 'https://evil.example/' }),
    )
    await expect(verifyOidcJwt(badIssuer, jwks, settings)).rejects.toThrow('Invalid issuer')
    const badAud = await signJwt(privateKey, { alg: 'RS256', kid: 'key-1' }, claims({ aud: 'other-app' }))
    await expect(verifyOidcJwt(badAud, jwks, settings)).rejects.toThrow('Invalid audience')
    const expired = await signJwt(
      privateKey,
      { alg: 'RS256', kid: 'key-1' },
      claims({ exp: Math.floor(Date.now() / 1000) - 3600 }),
    )
    await expect(verifyOidcJwt(expired, jwks, settings)).rejects.toThrow('Token expired')
  })

  test('rejects unknown key ids and unsigned algorithms', async () => {
    const { privateKey, jwks } = await setupKey()
    const unknownKid = await signJwt(privateKey, { alg: 'RS256', kid: 'rotated' }, claims())
    await expect(verifyOidcJwt(unknownKid, jwks, settings)).rejects.toThrow('Unknown key id')
    const headerB64 = encodePart({ alg: 'none' })
    await expect(verifyOidcJwt(`${headerB64}.${encodePart(claims())}.`, jwks, settings)).rejects.toThrow(
      'Unsupported JWT alg',
    )
  })

  test('does not treat unverified emails as verified', async () => {
    const { privateKey, jwks } = await setupKey()
    const token = await signJwt(privateKey, { alg: 'RS256', kid: 'key-1' }, claims({ email_verified: false }))
    await expect(verifyOidcJwt(token, jwks, settings)).resolves.toMatchObject({ emailVerified: false })
  })
})

describe('resolveOidcSession', () => {
  test('returns null without a bearer token and links a verified user', async () => {
    clearOidcCache()
    await expect(
      resolveOidcSession(new Request('https://app.example/'), {
        settings,
        jwksFetcher: async () => ({ keys: [] }),
        authFile: { providers: ['oidc-jwt'] },
      }),
    ).resolves.toBeNull()

    const { privateKey, jwks } = await setupKey()
    const token = await signJwt(privateKey, { alg: 'RS256', kid: 'key-1' }, claims())
    const db = stubDb([
      [],
      [{ id: 'user-9', email: 'sso@example.com', name: 'SSO User' }],
      [{ id: 'user-9', email: 'sso@example.com', name: 'SSO User' }],
      [],
    ])
    const principal = await resolveOidcSession(
      new Request('https://app.example/', { headers: { authorization: `Bearer ${token}` } }),
      {
        settings,
        jwksFetcher: async () => jwks,
        db: db as never,
        authFile: { providers: ['oidc-jwt'] },
      },
    )
    expect(principal).toMatchObject({
      userId: 'user-9',
      credential: { kind: 'external', provider: 'oidc-jwt', subject: 'user-123' },
    })
    clearOidcCache()
  })
})
