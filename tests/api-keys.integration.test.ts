import { afterAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { Route as AdminSitesRoute } from '@/routes/api.admin.sites'
import { Route as AdminSiteDetailRoute } from '@/routes/api.admin.sites.$siteKey'
import { Route as ApiKeysRoute } from '@/routes/api.admin.api-keys'
import { getBusinessAuth } from '@/server/auth/business-auth'
import { getBusinessDb } from '@/server/db/business-sql'
import { apikey, siteMemberships, sites } from '@/server/db/schema'

import { assertValidScopeSet, issueServiceKey } from '@/server/modules/api-keys/infrastructure/api-key-repository'
import {
  cleanupTestData,
  createOwner,
  createSignedInUser,
  handlerOf,
  handlerOfParams,
  jsonRequest,
  keyIds,
  siteKeys,
} from './helpers/integration'

const db = getBusinessDb()

afterAll(cleanupTestData)

describe('api key management gates', () => {
  test('collection routes reject anonymous and cross-origin callers', async () => {
    const origin = 'http://localhost:3000'
    const create = handlerOf(ApiKeysRoute, 'POST')
    expect((await create(jsonRequest(`${origin}/api/admin/api-keys`, 'POST', { name: 'x' }, { origin }))).status).toBe(
      401,
    )
    expect(
      (
        await create(
          jsonRequest(`${origin}/api/admin/api-keys`, 'POST', { name: 'x' }, { origin: 'https://evil.test' }),
        )
      ).status,
    ).toBe(403)
  })
})

describe('sites and site keys', () => {
  test('admin key CRUDs sites; site key manages one site’s keys', async () => {
    const ownerId = await createOwner()
    const adminKey = await issueServiceKey({
      userId: ownerId,
      name: 'site-manager',
      siteKey: null,
      scopes: ['sites:create', 'sites:read', 'sites:update', 'sites:delete'],
    })
    keyIds.push(adminKey.id)

    const createSite = handlerOf(AdminSitesRoute, 'POST')
    const listSites = handlerOf(AdminSitesRoute, 'GET')
    const created = await createSite(
      jsonRequest(
        'http://localhost:3000/api/admin/sites',
        'POST',
        { name: 'Scoped site', origin: 'https://scoped.example.test' },
        { authorization: `Bearer ${adminKey.key}` },
      ),
    )
    expect(created.status).toBe(200)
    const createdBody = (await created.json()) as { data: { site: { key: string } } }
    const siteKey = createdBody.data.site.key
    expect(siteKey).toMatch(/^scoped-site-[0-9a-f]{8}$/)
    siteKeys.push(siteKey)

    const listed = await listSites(
      new Request('http://localhost:3000/api/admin/sites', { headers: { authorization: `Bearer ${adminKey.key}` } }),
    )
    expect(listed.status).toBe(200)
    const listedBody = (await listed.json()) as { data: { sites: { key: string }[] } }
    expect(listedBody.data.sites.some((site) => site.key === siteKey)).toBe(true)

    // Admin key cannot mint site keys through the sites route scope — wrong permission.
    const narrowKey = await issueServiceKey({ userId: ownerId, name: 'reader', siteKey: null, scopes: ['sites:read'] })
    keyIds.push(narrowKey.id)
    const denied = await createSite(
      jsonRequest(
        'http://localhost:3000/api/admin/sites',
        'POST',
        { name: 'Nope', origin: 'https://nope.example.test' },
        { authorization: `Bearer ${narrowKey.key}` },
      ),
    )
    expect(denied.status).toBe(403)
    await expect(denied.json()).resolves.toMatchObject({ error: { code: 'INSUFFICIENT_SCOPE' } })

    // Site keys carry only page scopes, and the plugin's permission check sees
    // the binding in metadata.
    const publisherKey = await issueServiceKey({
      userId: ownerId,
      name: 'publisher',
      siteKey,
      scopes: ['pages:read', 'pages:write'],
    })
    keyIds.push(publisherKey.id)

    const otherSite = `scoped-other-${crypto.randomUUID()}`
    siteKeys.push(otherSite)
    await db.insert(sites).values({ key: otherSite, name: 'Other site' })
    const auth = getBusinessAuth()
    const crossCheck = await auth.api.verifyApiKey({
      body: { key: publisherKey.key, permissions: { pages: ['write'] } },
    })
    expect(crossCheck.valid).toBe(true)
    expect((crossCheck.key?.metadata as { siteKey?: string } | null)?.siteKey).toBe(siteKey)

    // Rename + delete via detail route with admin key.
    const patchSite = handlerOfParams(AdminSiteDetailRoute, 'PATCH')
    const renamed = await patchSite(
      jsonRequest(
        'http://localhost:3000/api/admin/sites/x',
        'PATCH',
        { name: 'Renamed' },
        { authorization: `Bearer ${adminKey.key}` },
      ),
      { siteKey },
    )
    expect(renamed.status).toBe(200)
    const renamedBody = (await renamed.json()) as { data: { site: { name: string } } }
    expect(renamedBody.data.site.name).toBe('Renamed')

    const deleteSite = handlerOfParams(AdminSiteDetailRoute, 'DELETE')
    const deleted = await deleteSite(
      new Request(`http://localhost:3000/api/admin/sites/${siteKey}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${adminKey.key}` },
      }),
      { siteKey },
    )
    expect(deleted.status).toBe(200)
    siteKeys.splice(siteKeys.indexOf(siteKey), 1)
  })

  test('mixed scope sets fail and disabled keys are rejected', async () => {
    const ownerId = await createOwner()
    const siteKey = `revoke-${crypto.randomUUID()}`
    siteKeys.push(siteKey)
    await db.insert(sites).values({ key: siteKey, name: 'Revoke site' })

    await expect(
      issueServiceKey({ userId: ownerId, name: 'bad', siteKey: null, scopes: ['pages:write'] }),
    ).rejects.toMatchObject({ code: 'INVALID_SCOPE_SET' })
    await expect(
      issueServiceKey({ userId: ownerId, name: 'bad', siteKey, scopes: ['sites:create'] }),
    ).rejects.toMatchObject({ code: 'INVALID_SCOPE_SET' })
    // Same validator guards PATCH: sites:* can never land on a site-bound key.
    expect(() => assertValidScopeSet(siteKey, ['sites:create'])).toThrow()
    expect(() => assertValidScopeSet(null, ['pages:read'])).toThrow()
    expect(() => assertValidScopeSet(siteKey, ['pages:read'])).not.toThrow()

    const key = await issueServiceKey({ userId: ownerId, name: 'doomed', siteKey, scopes: ['pages:read'] })
    keyIds.push(key.id)
    const auth = getBusinessAuth()
    await auth.api.updateApiKey({ body: { keyId: key.id, userId: ownerId, enabled: false } })
    const result = await auth.api.verifyApiKey({ body: { key: key.key, permissions: { pages: ['read'] } } })
    expect(result.valid).toBe(false)
  })

  test('a session site admin can rewrite scopes through the wrapper', async () => {
    // Regression: forwarding request headers made better-auth reject the
    // server-only `permissions` field, so every scope save 500'd.
    const { userId, cookie } = await createSignedInUser()
    const siteKey = `scope-update-${crypto.randomUUID()}`
    siteKeys.push(siteKey)
    const [site] = await db.insert(sites).values({ key: siteKey, name: 'Scope update site' }).returning({
      id: sites.id,
    })
    await db.insert(siteMemberships).values({ siteId: site!.id, userId, role: 'admin' })
    const key = await issueServiceKey({ userId, name: 'scope-update', siteKey, scopes: ['pages:read', 'pages:write'] })
    keyIds.push(key.id)

    const patchKey = handlerOf(ApiKeysRoute, 'PATCH')
    const response = await patchKey(
      jsonRequest(
        'http://localhost:3000/api/admin/api-keys',
        'PATCH',
        { keyId: key.id, siteKey, scopes: ['pages:read'] },
        { origin: 'http://localhost:3000', cookie },
      ),
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { updated: true } })

    const [row] = await db.select({ permissions: apikey.permissions }).from(apikey).where(eq(apikey.id, key.id))
    // The column stores JSON text; better-auth parses it on read.
    expect(JSON.parse(row?.permissions ?? 'null')).toEqual({ pages: ['read'] })
  })

  test('session users list and delete their own keys without the plugin endpoints', async () => {
    const { userId, cookie } = await createSignedInUser()
    const siteKey = `key-mgmt-${crypto.randomUUID()}`
    siteKeys.push(siteKey)
    const [site] = await db.insert(sites).values({ key: siteKey, name: 'Key mgmt site' }).returning({ id: sites.id })
    await db.insert(siteMemberships).values({ siteId: site!.id, userId, role: 'admin' })
    const key = await issueServiceKey({ userId, name: 'managed', siteKey, scopes: ['pages:read', 'pages:write'] })
    keyIds.push(key.id)

    const listKeys = handlerOf(ApiKeysRoute, 'GET')
    const listRequest = (headers: Record<string, string> = {}) =>
      new Request('http://localhost:3000/api/admin/api-keys', { headers })
    expect((await listKeys(listRequest())).status).toBe(401)
    const listed = await listKeys(listRequest({ cookie }))
    expect(listed.status).toBe(200)
    const listedBody = (await listed.json()) as {
      data: {
        keys: { id: string; name: string | null; start: string | null; permissions: unknown; metadata: unknown }[]
      }
    }
    expect(listedBody.data.keys).toHaveLength(1)
    expect(listedBody.data.keys[0]).toMatchObject({
      id: key.id,
      name: 'managed',
      permissions: { pages: ['read', 'write'] },
      metadata: { siteKey },
    })
    // The full secret never leaves the server on list — only the
    // non-secret start fragment and prefix (same as the plugin's list).
    expect(listedBody.data.keys[0]).not.toHaveProperty('key')
    expect(listedBody.data.keys[0]?.start).toMatch(/^lck_/)
    expect((listedBody.data.keys[0]?.start ?? '').length).toBeLessThan(16)

    const deleteKeys = handlerOf(ApiKeysRoute, 'DELETE')
    const deleteRequest = (query: string, headers: Record<string, string> = {}) =>
      new Request(`http://localhost:3000/api/admin/api-keys${query}`, { method: 'DELETE', headers })
    const origin = { origin: 'http://localhost:3000', cookie }
    // Wrong scope binding looks like a missing key, not a forbidden one.
    const crossSite = await deleteKeys(deleteRequest(`?keyId=${key.id}&siteKey=other-site`, origin))
    expect(crossSite.status).toBe(404)
    const removed = await deleteKeys(deleteRequest(`?keyId=${key.id}&siteKey=${siteKey}`, origin))
    expect(removed.status).toBe(200)
    await expect(removed.json()).resolves.toEqual({ data: { deleted: true } })
    keyIds.splice(keyIds.indexOf(key.id), 1)

    const relisted = await listKeys(listRequest({ cookie }))
    await expect(relisted.json()).resolves.toEqual({ data: { keys: [] } })
    const auth = getBusinessAuth()
    const check = await auth.api.verifyApiKey({ body: { key: key.key, permissions: { pages: ['read'] } } })
    expect(check.valid).toBe(false)
  })
})
