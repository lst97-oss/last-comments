import { afterAll, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { pluginDeliveries, pluginEvents, siteOrigins, sites } from '@/server/db/schema'
import { deliverPendingPluginEvents } from '@/server/plugins/plugin-delivery'
import { cleanupTestData, siteKeys } from './helpers/integration'

const db = getBusinessDb()

afterAll(cleanupTestData)

test('a stop signal hands the unsent plugin delivery back at once, attempt undone', async () => {
  const siteKey = `pdstop-${crypto.randomUUID()}`
  siteKeys.push(siteKey)
  const [site] = await db.insert(sites).values({ key: siteKey, name: 'Plugin stop' }).returning({ id: sites.id })
  await db.insert(siteOrigins).values({ siteId: site!.id, origin: 'https://example.test' })
  const [event] = await db
    .insert(pluginEvents)
    .values({ siteId: site!.id, eventType: 'comment.created', aggregateId: crypto.randomUUID(), payload: {} })
    .returning({ id: pluginEvents.id })
  const [delivery] = await db
    .insert(pluginDeliveries)
    .values({ eventId: event!.id, pluginId: 'stop-test' })
    .returning({ id: pluginDeliveries.id })

  const stopping = new AbortController()
  stopping.abort()
  const processed = await deliverPendingPluginEvents(db, new Date(), stopping.signal)

  expect(processed).toBe(0)
  const [row] = await db.select().from(pluginDeliveries).where(eq(pluginDeliveries.id, delivery!.id))
  expect(row?.status).toBe('pending')
  expect(row?.attempts).toBe(0)
  expect(row?.nextAttemptAt.getTime()).toBeLessThanOrEqual(Date.now())
})
