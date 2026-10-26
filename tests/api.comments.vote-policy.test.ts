import { afterAll, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { siteOrigins, sites } from '@/server/db/schema'
import { cleanupTestData, handlerOf, siteKeys } from './helpers/integration'

const db = getBusinessDb()
const origin = 'https://comments-client.example.test'

afterAll(cleanupTestData)

async function siteWith(values: { votesEnabled?: boolean; gatewayOnly?: boolean }) {
  const siteKey = `vote-policy-${crypto.randomUUID()}`
  siteKeys.push(siteKey)
  await db.insert(sites).values({ key: siteKey, name: 'Vote policy test', ...values })
  const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey))
  await db.insert(siteOrigins).values({ siteId: site!.id, origin })
  return siteKey
}

test('a site with voting off or gateway-only refuses votes before asking a visitor to sign in', async () => {
  Bun.env.BETTER_AUTH_URL = 'http://localhost:3000'
  Bun.env.BETTER_AUTH_SECRET = 'test-only-secret-at-least-32-characters'
  Bun.env.GOOGLE_CLIENT_ID = 'test-client-id'
  Bun.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

  const route = (await import('@/routes/api.comments.vote')).Route
  const putVote = handlerOf(route, 'PUT')
  const commentId = crypto.randomUUID()
  const putFor = (site: string) =>
    putVote(
      new Request('http://localhost:3000/api/comments/vote', {
        method: 'PUT',
        headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify({ site, commentId, value: 1 }),
      }),
    )

  const off = await putFor(await siteWith({ votesEnabled: false }))
  expect(off.status).toBe(403)
  await expect(off.json()).resolves.toMatchObject({ error: { code: 'FEATURE_DISABLED' } })

  const gateway = await putFor(await siteWith({ gatewayOnly: true }))
  expect(gateway.status).toBe(403)
  await expect(gateway.json()).resolves.toMatchObject({ error: { code: 'FORBIDDEN' } })

  // A site with voting on still asks for a session, as before.
  const on = await putFor(await siteWith({}))
  expect(on.status).toBe(401)
  await expect(on.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } })
})
