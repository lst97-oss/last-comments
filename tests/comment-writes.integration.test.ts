import { afterAll, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { pluginEvents, siteOrigins, sites } from '@/server/db/schema'
import { deleteOwnComment } from '@/server/modules/comments/infrastructure/comment-repository'
import { cleanupTestData, createTestComment, siteKeys } from './helpers/integration'

const db = getBusinessDb()

afterAll(cleanupTestData)

// The event log copies a comment's text only when a plugin subscribes, so the test writes the created event itself.
test('deleting a comment strips its text from the event log and keeps the event', async () => {
  const siteKey = `cwrites-${crypto.randomUUID()}`
  siteKeys.push(siteKey)
  const [site] = await db.insert(sites).values({ key: siteKey, name: 'Delete scrub' }).returning({ id: sites.id })
  await db.insert(siteOrigins).values({ siteId: site!.id, origin: 'https://example.test' })
  const pageUrl = 'https://example.test/scrub'
  const comment = await createTestComment({
    siteKey,
    pageUrl,
    userId: null,
    authorName: 'Guest Writer',
    bodyMarkdown: 'words that must not outlive the delete',
  })
  const [written] = await db
    .insert(pluginEvents)
    .values({
      siteId: site!.id,
      eventType: 'comment.created',
      aggregateId: comment.id,
      payload: {
        commentId: comment.id,
        pageUrl,
        authorName: 'Guest Writer',
        bodyMarkdown: 'words that must not outlive the delete',
        reasons: [],
      },
    })
    .returning({ id: pluginEvents.id })

  await deleteOwnComment({ siteKey, commentId: comment.id, userId: null, editKey: comment.editKey })

  // A plugin that subscribes to creation also writes its own event for the comment, so check every row for the text,
  // then the row this test wrote.
  const rows = await db.select().from(pluginEvents).where(eq(pluginEvents.aggregateId, comment.id))
  expect(JSON.stringify(rows.map((row) => row.payload))).not.toContain('words that must not outlive the delete')
  const [event] = rows.filter((row) => row.id === written!.id)
  expect(event?.eventType).toBe('comment.created')
  expect(event?.payload).toEqual({ commentId: comment.id, pageUrl, reasons: [] })
})
