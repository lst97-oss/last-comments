import { afterAll, expect, test } from 'bun:test'
import { and, eq, sql } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { comments, pages, siteOrigins, sites } from '@/server/db/schema'
import { deleteAdminSite } from '@/server/modules/admin/infrastructure/admin-repository'
import { createTestComment } from './helpers/integration'
import { cleanupTestData, siteKeys } from './helpers/integration'

const db = getBusinessDb()

afterAll(cleanupTestData)

test('deleting a site removes its pages, comments, origins and rate-limit windows, and only that site', async () => {
  const siteKey = `sdel-${crypto.randomUUID()}`
  const otherKey = `sdel-${crypto.randomUUID()}`
  // The cleanup helper removes whatever is still registered, so register both.
  siteKeys.push(siteKey, otherKey)

  const [site] = await db.insert(sites).values({ key: siteKey, name: 'Doomed' }).returning({ id: sites.id })
  await db.insert(siteOrigins).values({ siteId: site!.id, origin: 'https://doomed.example.test' })
  const doomedComment = await createTestComment({
    siteKey,
    pageUrl: 'https://doomed.example.test/post',
    userId: null,
    authorName: 'Guest',
    bodyMarkdown: 'gone with the site',
  })
  await db.execute(
    sql`insert into comment_rate_limit.rate_limit_windows (site_key, identity_hash, operation, window_start, count)
        values (${siteKey}, 'hash-doomed', 'comment.create', 1, 1)`,
  )

  const [survivor] = await db.insert(sites).values({ key: otherKey, name: 'Survivor' }).returning({ id: sites.id })
  await db.insert(siteOrigins).values({ siteId: survivor!.id, origin: 'https://survivor.example.test' })
  const survivingComment = await createTestComment({
    siteKey: otherKey,
    pageUrl: 'https://survivor.example.test/post',
    userId: null,
    authorName: 'Guest',
    bodyMarkdown: 'stays',
  })

  await deleteAdminSite(siteKey)

  const [gone] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey))
  expect(gone).toBeUndefined()
  const [doomedRow] = await db.select({ id: comments.id }).from(comments).where(eq(comments.id, doomedComment.id))
  expect(doomedRow).toBeUndefined()
  const doomedPages = await db.select({ id: pages.id }).from(pages).where(eq(pages.siteId, site!.id))
  expect(doomedPages).toHaveLength(0)
  const doomedOrigins = await db
    .select({ id: siteOrigins.id })
    .from(siteOrigins)
    .where(eq(siteOrigins.siteId, site!.id))
  expect(doomedOrigins).toHaveLength(0)
  const windows = await db.execute(sql`select 1 from comment_rate_limit.rate_limit_windows where site_key = ${siteKey}`)
  expect(windows.length).toBe(0)

  const [keptRow] = await db
    .select({ id: comments.id })
    .from(comments)
    .where(and(eq(comments.id, survivingComment.id)))
  expect(keptRow?.id).toBe(survivingComment.id)
})

test('deleting an unknown site is SITE_NOT_FOUND', async () => {
  await expect(deleteAdminSite(`never-${crypto.randomUUID()}`)).rejects.toMatchObject({
    code: 'SITE_NOT_FOUND',
    status: 404,
  })
})
