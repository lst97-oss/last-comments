import { describe, expect, test } from 'bun:test'

import { linkOrProvisionExternalUser, maybeBootstrapInstanceAdmin } from '@/server/auth/external-identities'
import { resolveHeaderSession } from '@/server/auth/header-provider'
import { isProxySourceAllowed } from '@/server/http/proxy-source'

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
  AUTH_LINK_BY_EMAIL: false,
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
  test('returns null when proxy trust is off, the peer is outside the proxy CIDR, or subject is missing', async () => {
    const off = await resolveHeaderSession(
      new Request('https://app.example/', { headers: { 'x-forwarded-user': 'sso-user' } }),
      { settings: { ...trustSettings, AUTH_TRUST_PROXY: false }, remoteAddr: '10.4.5.6' },
    )
    expect(off).toBeNull()
    const untrusted = await resolveHeaderSession(
      new Request('https://app.example/', { headers: { 'x-forwarded-user': 'sso-user' } }),
      { settings: trustSettings, remoteAddr: '203.0.113.9' },
    )
    expect(untrusted).toBeNull()
    const noSubject = await resolveHeaderSession(new Request('https://app.example/'), {
      settings: trustSettings,
      remoteAddr: '10.4.5.6',
    })
    expect(noSubject).toBeNull()
  })

  test('a forwarded address never makes an outside peer trusted', async () => {
    const spoofed = await resolveHeaderSession(
      new Request('https://app.example/', {
        headers: { 'x-forwarded-user': 'admin', 'x-forwarded-for': '10.4.5.6', 'x-forwarded-email': 'a@example.com' },
      }),
      { settings: trustSettings, remoteAddr: '203.0.113.9', db: stubDb() as never },
    )
    expect(spoofed).toBeNull()
  })

  test('without a socket peer nothing is trusted, even with the wildcard CIDR', async () => {
    const noPeer = await resolveHeaderSession(
      new Request('https://app.example/', { headers: { 'x-forwarded-user': 'sso-user' } }),
      { settings: { ...trustSettings, AUTH_PROXY_CIDR: '*' }, remoteAddr: null },
    )
    expect(noPeer).toBeNull()
  })

  test('reads the socket peer from the runtime context when no override is given', async () => {
    const request = Object.assign(
      new Request('https://app.example/', { headers: { 'x-forwarded-user': 'sso-user' } }),
      {
        context: { clientAddress: '10.4.5.6' },
      },
    )
    const principal = await resolveHeaderSession(request, { settings: trustSettings, db: stubDb([[], []]) as never })
    expect(principal).toMatchObject({ credential: { kind: 'external', provider: 'header', subject: 'sso-user' } })
  })

  test('creates a separate account for a trusted proxy login by default, even when the email exists', async () => {
    const db = stubDb([[], [{ id: 'admin-1', email: 'proxy@example.com', name: 'Admin' }]])
    const principal = await resolveHeaderSession(
      new Request('https://app.example/', {
        headers: { 'x-forwarded-user': 'sso-user', 'x-forwarded-email': 'proxy@example.com' },
      }),
      { settings: trustSettings, remoteAddr: '10.4.5.6', db: db as never, authFile: { providers: ['header'] } },
    )
    expect(principal).toMatchObject({
      userId: 'new-user-id',
      credential: { kind: 'external', provider: 'header', subject: 'sso-user' },
    })
    expect(principal?.userId).not.toBe('admin-1')
  })

  test('links to the existing account only when header.linkByEmail is on', async () => {
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
      {
        settings: { ...trustSettings, AUTH_LINK_BY_EMAIL: true },
        remoteAddr: '10.4.5.6',
        db: db as never,
        authFile: { providers: ['header'] },
      },
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
      { provider: 'oidc-jwt', subject: 'sub-2', email: 'B@Example.com', emailVerified: true, mergeByEmail: true },
      { db: db as never },
    )
    expect(result.userId).toBe('user-2')
    expect(db.inserted.length).toBe(1)
  })

  test('never merges without mergeByEmail, even for a verified email', async () => {
    const db = stubDb([[], []])
    const result = await linkOrProvisionExternalUser(
      { provider: 'oidc-jwt', subject: 'sub-3', email: 'c@example.com', emailVerified: true },
      { db: db as never },
    )
    expect(result.userId).toBe('new-user-id')
    expect(db.inserted.length).toBe(2)
  })

  test('keeps an unverified email on the new account when no one else holds it', async () => {
    const created = await linkOrProvisionExternalUser(
      { provider: 'header', subject: 'mallory', email: 'victim@example.com', emailVerified: false },
      { db: stubDb([[], []]) as never },
    )
    expect(created.email).toBe('victim@example.com')
  })

  test('gives a new account a stub address when another account already holds the email', async () => {
    const created = await linkOrProvisionExternalUser(
      { provider: 'header', subject: 'mallory', email: 'victim@example.com' },
      { db: stubDb([[], [{ id: 'victim-1' }]]) as never },
    )
    expect(created.email).toBe('header+mallory@invalid.local')
  })

  test('refuses to provision when auto-provision is off', async () => {
    await expect(
      linkOrProvisionExternalUser(
        { provider: 'header', subject: 'stranger' },
        { db: stubDb([[]]) as never, autoProvision: false },
      ),
    ).rejects.toThrow('auto-provision is disabled')
  })
})
