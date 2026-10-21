import { describe, expect, test } from 'bun:test'

import { linkOrProvisionExternalUser, maybeBootstrapInstanceAdmin } from '@/server/auth/external-identities'
import { isProxySourceAllowed, resolveHeaderSession } from '@/server/auth/header-provider'

// Minimal drizzle stub: queued select() results; insert().values() records rows.
function stubDb(selectQueue: unknown[][] = []) {
  const inserted: unknown[] = []
  const chain = (rows: unknown[]) => ({
    from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }), limit: () => Promise.resolve(rows) }),
  })
  return {
    inserted,
    select: () => chain((selectQueue.shift() ?? []) as unknown[]),
    insert: () => ({
      values: (values: unknown) => {
        inserted.push(values)
        const row = values as { email?: string; name?: string }
        return {
          returning: () => Promise.resolve([{ id: 'new-user-id', email: row.email ?? null, name: row.name ?? null }]),
          onConflictDoNothing: () => Promise.resolve(),
        }
      },
    }),
  }
}

const trustSettings = {
  AUTH_TRUST_PROXY: true,
  AUTH_PROXY_CIDR: '10.0.0.0/8',
  AUTH_HEADER_USER: 'x-forwarded-user',
  AUTH_HEADER_EMAIL: 'x-forwarded-email',
  AUTH_HEADER_NAME: 'x-forwarded-name',
}

describe('isProxySourceAllowed', () => {
  test('wildcard allows even without an address; exact and CIDR match', () => {
    expect(isProxySourceAllowed(null, '*')).toBe(true)
    expect(isProxySourceAllowed('10.1.2.3', '10.1.2.3')).toBe(true)
    expect(isProxySourceAllowed('10.9.9.9', '10.0.0.0/8')).toBe(true)
    expect(isProxySourceAllowed('192.168.1.1', '10.0.0.0/8')).toBe(false)
    expect(isProxySourceAllowed(null, '10.0.0.0/8')).toBe(false)
  })
})

describe('resolveHeaderSession', () => {
  test('returns null when proxy trust is off, source is untrusted, or subject is missing', async () => {
    const off = await resolveHeaderSession(
      new Request('https://app.example/', { headers: { 'x-forwarded-user': 'sso-user' } }),
      { settings: { ...trustSettings, AUTH_TRUST_PROXY: false } },
    )
    expect(off).toBeNull()
    const untrusted = await resolveHeaderSession(
      new Request('https://app.example/', {
        headers: { 'x-forwarded-user': 'sso-user', 'x-forwarded-for': '203.0.113.9' },
      }),
      { settings: trustSettings, remoteAddr: '203.0.113.9' },
    )
    expect(untrusted).toBeNull()
    const noSubject = await resolveHeaderSession(new Request('https://app.example/'), {
      settings: trustSettings,
      remoteAddr: '10.4.5.6',
    })
    expect(noSubject).toBeNull()
  })

  test('maps a trusted proxy subject to a principal', async () => {
    const db = stubDb([
      [],
      [{ id: 'user-7', email: 'proxy@example.com', name: 'Proxy User' }],
      [{ id: 'user-7', email: 'proxy@example.com', name: 'Proxy User' }],
      [],
    ])
    const principal = await resolveHeaderSession(
      new Request('https://app.example/', {
        headers: { 'x-forwarded-user': 'sso-user', 'x-forwarded-email': 'proxy@example.com' },
      }),
      { settings: trustSettings, remoteAddr: '10.4.5.6', db: db as never, authFile: { providers: ['header'] } },
    )
    expect(principal).toMatchObject({
      userId: 'user-7',
      credential: { kind: 'external', provider: 'header', subject: 'sso-user' },
    })
  })
})

describe('maybeBootstrapInstanceAdmin', () => {
  test('claims the empty admin slot on first login', async () => {
    const db = stubDb([[]])
    await expect(maybeBootstrapInstanceAdmin('user-7', 'proxy@example.com', { db: db as never })).resolves.toBe(true)
    expect(db.inserted).toEqual([{ slot: 1, userId: 'user-7' }])
  })

  test('does nothing once an admin exists', async () => {
    const db = stubDb([[{ userId: 'user-1' }]])
    await expect(maybeBootstrapInstanceAdmin('user-7', 'proxy@example.com', { db: db as never })).resolves.toBe(false)
    expect(db.inserted).toEqual([])
  })

  test('bootstrap email restricts who may claim the slot', async () => {
    const blocked = stubDb([[]])
    await expect(
      maybeBootstrapInstanceAdmin('user-9', 'someone@example.com', {
        db: blocked as never,
        bootstrapEmail: 'owner@example.com',
      }),
    ).resolves.toBe(false)
    expect(blocked.inserted).toEqual([])
    const allowed = stubDb([[]])
    await expect(
      maybeBootstrapInstanceAdmin('user-1', 'Owner@Example.com', {
        db: allowed as never,
        bootstrapEmail: 'owner@example.com',
      }),
    ).resolves.toBe(true)
    expect(allowed.inserted).toEqual([{ slot: 1, userId: 'user-1' }])
  })
})

describe('linkOrProvisionExternalUser', () => {
  test('reuses an already-linked identity without inserts', async () => {
    const db = stubDb([[{ userId: 'user-1' }], [{ id: 'user-1', email: 'a@example.com', name: 'A' }]])
    await expect(
      linkOrProvisionExternalUser({ provider: 'oidc-jwt', subject: 'sub-1' }, { db: db as never }),
    ).resolves.toEqual({ userId: 'user-1', email: 'a@example.com', displayName: 'A' })
    expect(db.inserted).toEqual([])
  })

  test('links a verified email to the existing user instead of creating one', async () => {
    const db = stubDb([
      [],
      [{ id: 'user-2', email: 'b@example.com', name: 'B' }],
      [{ id: 'user-2', email: 'b@example.com', name: 'B' }],
    ])
    const result = await linkOrProvisionExternalUser(
      { provider: 'oidc-jwt', subject: 'sub-2', email: 'B@Example.com', emailVerified: true },
      { db: db as never },
    )
    expect(result.userId).toBe('user-2')
    expect(db.inserted.length).toBe(1)
  })

  test('never merges on unverified email and refuses when auto-provision is off', async () => {
    const createDb = () => stubDb([[], []])
    const created = await linkOrProvisionExternalUser(
      { provider: 'header', subject: 'mallory', email: 'victim@example.com', emailVerified: false },
      { db: createDb() as never },
    )
    expect(created.email).toBe('victim@example.com')
    await expect(
      linkOrProvisionExternalUser(
        { provider: 'header', subject: 'stranger' },
        { db: stubDb([[]]) as never, autoProvision: false },
      ),
    ).rejects.toThrow('auto-provision is disabled')
  })
})
