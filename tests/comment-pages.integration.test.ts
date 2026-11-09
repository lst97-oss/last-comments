import { afterAll, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { pages, siteOrigins, sites } from '@/server/db/schema'
import { resolvePage } from '@/server/modules/comments/infrastructure/comment-pages'
import { cleanupTestData, siteKeys } from './helpers/integration'

const db = getBusinessDb()

afterAll(cleanupTestData)

async function createSite(): Promise<string> {
  const siteKey = `cpages-${crypto.randomUUID()}`
  siteKeys.push(siteKey)
  const [site] = await db.insert(sites).values({ key: siteKey, name: 'Concurrent pages' }).returning({ id: sites.id })
  await db.insert(siteOrigins).values({ siteId: site!.id, origin: 'https://example.test' })
  return site!.id
}

// Two first comments on a brand-new slugged page can arrive in the same moment. Both must end up on one thread;
// neither may fail with a duplicate-key error.
test('simultaneous first comments on a new slugged page share one thread', async () => {
  const siteId = await createSite()
  const rounds = 15

  for (let round = 0; round < rounds; round++) {
    const input = { siteId, pageUrl: `https://example.test/race-${round}`, pageKey: `race-${round}`, title: 'Race' }
    const [first, second] = await Promise.all([
      db.transaction((tx) => resolvePage(tx, input)),
      db.transaction((tx) => resolvePage(tx, input)),
    ])
    expect(second).toBe(first)
  }

  const rows = await db.select({ id: pages.id }).from(pages).where(eq(pages.siteId, siteId))
  expect(rows).toHaveLength(rounds)
})
