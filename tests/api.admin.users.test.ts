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
const siteKey = `admin-users-${crypto.randomUUID()}`
let adminLoan: InstanceAdminLoan | undefined

afterAll(async () => {
  if (adminLoan) await returnInstanceAdmin(adminLoan)
  await cleanupTestData()
})

test('the user directory is limited to site admins', async () => {
  Bun.env.BETTER_AUTH_URL = 'http://localhost:3000'
  Bun.env.BETTER_AUTH_SECRET = 'test-only-secret-at-least-32-characters'
  Bun.env.GOOGLE_CLIENT_ID = 'test-client-id'
  Bun.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

  siteKeys.push(siteKey)
  const [site] = await db().insert(sites).values({ key: siteKey, name: 'Directory site' }).returning({ id: sites.id })

  const member = await createSignedInUser()
  const siteAdmin = await createSignedInUser()
  await db()
    .insert(siteMemberships)
    .values([
      { siteId: site!.id, userId: member.userId, role: 'member' },
      { siteId: site!.id, userId: siteAdmin.userId, role: 'admin' },
    ])

  // Static imports would load the better-auth graph before the env vars above.
  const list = handlerOf((await import('@/routes/api.admin.users')).Route, 'GET')
  const request = (cookie: string) =>
    list(new Request(`http://localhost:3000/api/admin/users?site=${siteKey}`, { headers: { cookie } }))

  const memberResponse = await request(member.cookie)
  expect(memberResponse.status).toBe(403)
  const memberPayload = (await memberResponse.json()) as { error: { code: string } }
  expect(memberPayload.error.code).toBe('FORBIDDEN')

  const siteAdminResponse = await request(siteAdmin.cookie)
  expect(siteAdminResponse.status).toBe(200)

  adminLoan = await lendInstanceAdmin(member.userId)
  const instanceAdminResponse = await request(member.cookie)
  expect(instanceAdminResponse.status).toBe(200)
})
