import { afterAll, expect, test } from 'bun:test'
import { getBusinessDb } from '@/server/db/business-sql'
import { siteMemberships, sites } from '@/server/db/schema'
import { listModerationSites } from '@/server/modules/comments/infrastructure/moderation-queries'
import { cleanupTestData, createSignedInUser, siteKeys } from './helpers/integration'

// Lazy: another test file's drainAll() closes the shared pool mid-run.
const db = () => getBusinessDb()

afterAll(async () => {
  await cleanupTestData()
})

// The API key form selects comment features from each site's access setting, and it reads this list.
test('the moderation site list carries the access setting and gateway flag', async () => {
  Bun.env.BETTER_AUTH_URL = 'http://localhost:3000'
  Bun.env.BETTER_AUTH_SECRET = 'test-only-secret-at-least-32-characters'
  Bun.env.GOOGLE_CLIENT_ID = 'test-client-id'
  Bun.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

  const { userId } = await createSignedInUser()
  const siteKey = `moderation-access-${crypto.randomUUID()}`
  siteKeys.push(siteKey)
  const [site] = await db()
    .insert(sites)
    .values({ key: siteKey, name: 'Access test', access: 'private', gatewayOnly: true })
    .returning({ id: sites.id })
  await db().insert(siteMemberships).values({ siteId: site!.id, userId, role: 'admin' })

  const listed = (await listModerationSites(userId)).find((row) => row.key === siteKey)
  expect(listed).toMatchObject({ access: 'private', gatewayOnly: true, role: 'admin' })
})
