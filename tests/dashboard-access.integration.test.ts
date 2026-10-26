import { afterAll, expect, test } from 'bun:test'

import { getBusinessDb } from '@/server/db/business-sql'
import { siteMemberships, sites } from '@/server/db/schema'
import {
  cleanupTestData,
  createSignedInUser,
  handlerOf,
  type InstanceAdminLoan,
  lendInstanceAdmin,
  returnInstanceAdmin,
  siteKeys,
} from './helpers/integration'

// Lazy: another test file's drainAll() closes the shared pool.
const db = () => getBusinessDb()
const suffix = crypto.randomUUID()
const adminSiteKey = `dashboard-admin-${suffix}`
const memberSiteKey = `dashboard-member-${suffix}`
let loan: InstanceAdminLoan | undefined

afterAll(async () => {
  if (loan) await returnInstanceAdmin(loan)
  await cleanupTestData()
})

// Both tests share one pair of sites, so the keys are inserted once.
let seeded: Promise<{ adminSiteId: string; memberSiteId: string }> | undefined

function seedSites(): Promise<{ adminSiteId: string; memberSiteId: string }> {
  seeded ??= (async () => {
    siteKeys.push(adminSiteKey, memberSiteKey)
    const rows = await db()
      .insert(sites)
      .values([
        { key: adminSiteKey, name: 'Dashboard admin site' },
        { key: memberSiteKey, name: 'Dashboard member site' },
      ])
      .returning({ id: sites.id, key: sites.key })
    return {
      adminSiteId: rows.find((row) => row.key === adminSiteKey)!.id,
      memberSiteId: rows.find((row) => row.key === memberSiteKey)!.id,
    }
  })()
  return seeded
}

function withSession(url: string, cookie?: string): Request {
  return new Request(url, cookie ? { headers: { cookie } } : undefined)
}

test('only the instance admin and an admin of a site may use the dashboard', async () => {
  Bun.env.BETTER_AUTH_URL = 'http://localhost:3000'
  Bun.env.BETTER_AUTH_SECRET = 'test-only-secret-at-least-32-characters'
  Bun.env.GOOGLE_CLIENT_ID = 'test-client-id'
  Bun.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

  const { adminSiteId, memberSiteId } = await seedSites()
  const { hasDashboardAccess } = await import('@/server/modules/admin/infrastructure/dashboard-access')

  const plain = await createSignedInUser()
  const member = await createSignedInUser()
  const siteAdmin = await createSignedInUser()
  await db()
    .insert(siteMemberships)
    .values([
      { siteId: memberSiteId, userId: member.userId, role: 'member' },
      { siteId: adminSiteId, userId: siteAdmin.userId, role: 'admin' },
    ])

  expect(await hasDashboardAccess(plain.userId)).toBe(false)
  expect(await hasDashboardAccess(member.userId)).toBe(false)
  expect(await hasDashboardAccess(siteAdmin.userId)).toBe(true)

  loan = await lendInstanceAdmin(plain.userId)
  expect(await hasDashboardAccess(plain.userId)).toBe(true)
})

test('/api/session tells the client whether the identity may use the dashboard', async () => {
  const { memberSiteId, adminSiteId } = await seedSites()
  const session = handlerOf((await import('@/routes/api.session')).Route, 'GET')
  const url = 'http://localhost:3000/api/session'

  const anonymous = (await (await session(withSession(url))).json()) as {
    data: { principal: unknown; dashboard: boolean }
  }
  expect(anonymous.data).toEqual({ principal: null, dashboard: false })

  const member = await createSignedInUser()
  await db().insert(siteMemberships).values({ siteId: memberSiteId, userId: member.userId, role: 'member' })
  const asMember = (await (await session(withSession(url, member.cookie))).json()) as {
    data: { principal: { userId: string } | null; dashboard: boolean }
  }
  expect(asMember.data.principal?.userId).toBe(member.userId)
  expect(asMember.data.dashboard).toBe(false)

  const siteAdmin = await createSignedInUser()
  await db().insert(siteMemberships).values({ siteId: adminSiteId, userId: siteAdmin.userId, role: 'admin' })
  const asAdmin = (await (await session(withSession(url, siteAdmin.cookie))).json()) as {
    data: { principal: { userId: string } | null; dashboard: boolean }
  }
  expect(asAdmin.data.dashboard).toBe(true)
})

test('a member cannot list sites or read API keys, and an admin sees only the sites they administer', async () => {
  const { adminSiteId, memberSiteId } = await seedSites()
  const listSites = handlerOf((await import('@/routes/api.admin.sites')).Route, 'GET')
  const listKeys = handlerOf((await import('@/routes/api.admin.api-keys')).Route, 'GET')
  const sitesUrl = 'http://localhost:3000/api/admin/sites'
  const keysUrl = 'http://localhost:3000/api/admin/api-keys'

  const member = await createSignedInUser()
  await db().insert(siteMemberships).values({ siteId: memberSiteId, userId: member.userId, role: 'member' })
  const memberSites = await listSites(withSession(sitesUrl, member.cookie))
  expect(memberSites.status).toBe(403)
  expect(((await memberSites.json()) as { error: { code: string } }).error.code).toBe('FORBIDDEN')
  expect((await listKeys(withSession(keysUrl, member.cookie))).status).toBe(403)

  // A site admin who is also a member of another site: only the administered site is listed.
  const siteAdmin = await createSignedInUser()
  await db()
    .insert(siteMemberships)
    .values([
      { siteId: adminSiteId, userId: siteAdmin.userId, role: 'admin' },
      { siteId: memberSiteId, userId: siteAdmin.userId, role: 'member' },
    ])
  const adminResponse = await listSites(withSession(sitesUrl, siteAdmin.cookie))
  expect(adminResponse.status).toBe(200)
  const adminPayload = (await adminResponse.json()) as { data: { sites: { key: string }[] } }
  expect(adminPayload.data.sites.map((site) => site.key)).toEqual([adminSiteKey])
  expect((await listKeys(withSession(keysUrl, siteAdmin.cookie))).status).toBe(200)
})
