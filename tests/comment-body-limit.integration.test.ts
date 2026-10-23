import { afterAll, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { COMMENT_BODY_LIMIT, resolveBodyLimit, siteBodyLimitSchema } from '@/lib/comment-schema'
import { getBusinessDb } from '@/server/db/business-sql'
import { sites } from '@/server/db/schema'
import { siteUpdateSchema } from '@/server/modules/admin/http/admin-schemas'
import { updateAdminSite } from '@/server/modules/admin/infrastructure/admin-repository'
import { editOwnComment } from '@/server/modules/comments/infrastructure/comment-repository'
import { cleanupTestData, createTestComment, siteKeys } from './helpers/integration'

const db = getBusinessDb()

afterAll(cleanupTestData)

async function createSite(bodyLimit: number | null): Promise<string> {
  const siteKey = `limit-${crypto.randomUUID()}`
  siteKeys.push(siteKey)
  await db.insert(sites).values({ key: siteKey, name: 'Body limit test', bodyLimit })
  return siteKey
}

test('the default is the ceiling, and a site can only lower it', () => {
  expect(COMMENT_BODY_LIMIT).toBe(10_000)
  expect(resolveBodyLimit(null)).toBe(10_000)
  expect(resolveBodyLimit(4096)).toBe(4096)
  expect(resolveBodyLimit(99_999)).toBe(10_000)
})

test('the admin schema accepts 1 to the ceiling or null, and nothing else', () => {
  expect(siteBodyLimitSchema.safeParse(4096).success).toBe(true)
  expect(siteBodyLimitSchema.safeParse(0).success).toBe(false)
  expect(siteBodyLimitSchema.safeParse(10_001).success).toBe(false)
  expect(siteUpdateSchema.safeParse({ bodyLimit: null }).success).toBe(true)
  expect(siteUpdateSchema.safeParse({ bodyLimit: 4096, name: 'Blog' }).success).toBe(true)
  expect(siteUpdateSchema.safeParse({ bodyLimit: 10_001 }).success).toBe(false)
  expect(siteUpdateSchema.safeParse({ nope: true }).success).toBe(false)
})

test('the database refuses a limit outside 1 to the ceiling', async () => {
  const siteKey = `limit-${crypto.randomUUID()}`
  siteKeys.push(siteKey)
  // Drizzle's insert is a lazy builder; Promise.resolve runs it so the rejection is observable.
  await expect(
    Promise.resolve(db.insert(sites).values({ key: siteKey, name: 'Bad limit', bodyLimit: 0 })),
  ).rejects.toThrow()
})

test('a public comment over the site limit is refused, and exactly the limit is accepted', async () => {
  const siteKey = await createSite(4096)
  const pageUrl = 'https://example.test/limit-create'

  await expect(
    createTestComment({ siteKey, pageUrl, userId: null, authorName: 'Guest', bodyMarkdown: 'a'.repeat(4097) }),
  ).rejects.toMatchObject({ code: 'COMMENT_TOO_LONG', status: 400 })

  const created = await createTestComment({
    siteKey,
    pageUrl,
    userId: null,
    authorName: 'Guest',
    bodyMarkdown: 'a'.repeat(4096),
  })
  expect(created.id).toBeString()
})

test('a site without its own limit keeps the 10,000 default', async () => {
  const siteKey = await createSite(null)
  const created = await createTestComment({
    siteKey,
    pageUrl: 'https://example.test/limit-default',
    userId: null,
    authorName: 'Guest',
    bodyMarkdown: 'a'.repeat(9_000),
  })
  expect(created.id).toBeString()
})

test('an edit over the site limit is refused before the body is written', async () => {
  const siteKey = await createSite(4096)
  const created = await createTestComment({
    siteKey,
    pageUrl: 'https://example.test/limit-edit',
    userId: null,
    authorName: 'Guest',
    bodyMarkdown: 'short',
  })
  expect(created.editKey).toBeString()

  await expect(
    editOwnComment({
      siteKey,
      commentId: created.id,
      userId: null,
      bodyMarkdown: 'a'.repeat(4097),
      editKey: created.editKey,
    }),
  ).rejects.toMatchObject({ code: 'COMMENT_TOO_LONG', status: 400 })
})

test('updating a site changes only the fields given, and an empty update is refused', async () => {
  const siteKey = await createSite(4096)

  const renamed = await updateAdminSite(siteKey, { name: 'Renamed only' })
  expect(renamed).toMatchObject({ name: 'Renamed only', bodyLimit: 4096 })

  const reset = await updateAdminSite(siteKey, { bodyLimit: null })
  expect(reset.bodyLimit).toBeNull()

  await expect(updateAdminSite(siteKey, {})).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 })

  const [row] = await db.select({ bodyLimit: sites.bodyLimit }).from(sites).where(eq(sites.key, siteKey))
  expect(row?.bodyLimit).toBeNull()
})
