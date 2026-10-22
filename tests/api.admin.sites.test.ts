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
const memberSiteKey = `admin-sites-member-${crypto.randomUUID()}`
const otherSiteKey = `admin-sites-other-${crypto.randomUUID()}`
let adminLoan: InstanceAdminLoan | undefined

afterAll(async () => {
  if (adminLoan) await returnInstanceAdmin(adminLoan)
  await cleanupTestData()
})

test('the site list shows the caller their own sites and the instance admin every site', async () => {
  Bun.env.BETTER_AUTH_URL = 'http://localhost:3000'
  Bun.env.BETTER_AUTH_SECRET = 'test-only-secret-at-least-32-characters'
  Bun.env.GOOGLE_CLIENT_ID = 'test-client-id'
  Bun.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

  const { userId, cookie } = await createSignedInUser()

  siteKeys.push(memberSiteKey, otherSiteKey)
  const [memberSite] = await db()
    .insert(sites)
    .values({ key: memberSiteKey, name: 'Member site' })
    .returning({ id: sites.id })
  await db().insert(sites).values({ key: otherSiteKey, name: 'Other site' })
  await db().insert(siteMemberships).values({ siteId: memberSite!.id, userId, role: 'admin' })

  // Static imports would load the better-auth graph before the env vars above.
  const list = handlerOf((await import('@/routes/api.admin.sites')).Route, 'GET')
  const request = (headers: Record<string, string> = {}) =>
    list(new Request('http://localhost:3000/api/admin/sites', { headers }))

  const memberResponse = await request({ cookie })
  expect(memberResponse.status).toBe(200)
  const memberPayload = (await memberResponse.json()) as { data: { sites: { key: string }[] } }
  expect(memberPayload.data.sites.map((site) => site.key)).toEqual([memberSiteKey])

  adminLoan = await lendInstanceAdmin(userId)
  const adminResponse = await request({ cookie })
  expect(adminResponse.status).toBe(200)
  const adminPayload = (await adminResponse.json()) as { data: { sites: { key: string }[] } }
  const adminSiteKeys = adminPayload.data.sites.map((site) => site.key)
  expect(adminSiteKeys).toContain(memberSiteKey)
  expect(adminSiteKeys).toContain(otherSiteKey)
})
