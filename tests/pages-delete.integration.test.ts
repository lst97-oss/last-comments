import { afterAll, expect, test } from 'bun:test'
import { and, eq } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { comments, moderationEvents, pages, siteOrigins, sites, votes } from '@/server/db/schema'
import { assertValidScopeSet, scopesToPermissions } from '@/server/modules/api-keys/infrastructure/api-key-repository'
import { castCommentVote, deletePage, upsertPage } from '@/server/modules/comments/infrastructure/comment-repository'
import { cleanupTestData, createOwner, createTestComment, siteKeys } from './helpers/integration'

const db = getBusinessDb()

afterAll(cleanupTestData)

async function createSite(): Promise<{ siteKey: string; siteId: string }> {
  const siteKey = `pdel-${crypto.randomUUID()}`
  siteKeys.push(siteKey)
  const [site] = await db.insert(sites).values({ key: siteKey, name: 'Page delete test' }).returning({ id: sites.id })
  // upsertPage only accepts URLs under a registered origin.
  await db.insert(siteOrigins).values({ siteId: site!.id, origin: 'https://example.test' })
  return { siteKey, siteId: site!.id }
}

test('deleting a page removes its comments, replies and votes, and nothing else', async () => {
  const { siteKey, siteId } = await createSite()
  const voter = await createOwner()
  const doomedUrl = 'https://example.test/delete-me'
  const keptUrl = 'https://example.test/keep-me'

  const parent = await createTestComment({
    siteKey,
    pageUrl: doomedUrl,
    userId: null,
    authorName: 'Guest',
    bodyMarkdown: 'parent',
  })
  const reply = await createTestComment({
    siteKey,
    pageUrl: doomedUrl,
    userId: null,
    authorName: 'Guest',
    bodyMarkdown: 'reply',
    parentId: parent.id,
  })
  await castCommentVote(siteKey, parent.id, voter, 1)
  const kept = await createTestComment({
    siteKey,
    pageUrl: keptUrl,
    userId: null,
    authorName: 'Guest',
    bodyMarkdown: 'kept',
  })

  const [doomed] = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.canonicalUrl, doomedUrl)))
  const actor = await createOwner()

  const result = await deletePage(siteId, actor, { pageId: doomed!.id })
  expect(result).toEqual({ deleted: true, comments: 2, replies: 1, votes: 1 })

  const gone = await db.select({ id: comments.id }).from(comments).where(eq(comments.pageId, doomed!.id))
  expect(gone).toHaveLength(0)
  const orphanVotes = await db.select({ id: votes.id }).from(votes).where(eq(votes.commentId, parent.id))
  expect(orphanVotes).toHaveLength(0)
  const [replyRow] = await db.select({ id: comments.id }).from(comments).where(eq(comments.id, reply.id))
  expect(replyRow).toBeUndefined()

  const [keptRow] = await db.select({ id: comments.id }).from(comments).where(eq(comments.id, kept.id))
  expect(keptRow?.id).toBe(kept.id)

  const audit = await db
    .select({ action: moderationEvents.action, reason: moderationEvents.reason })
    .from(moderationEvents)
    .where(and(eq(moderationEvents.siteId, siteId), eq(moderationEvents.targetId, doomed!.id)))
  expect(audit).toEqual([{ action: 'page.delete', reason: doomedUrl }])
})

test('a repeat delete, or a page from another site, is PAGE_NOT_FOUND', async () => {
  const { siteKey, siteId } = await createSite()
  const otherSite = await createSite()
  await createTestComment({
    siteKey,
    pageUrl: 'https://example.test/once',
    userId: null,
    authorName: 'Guest',
    bodyMarkdown: 'once',
  })
  const [page] = await db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.canonicalUrl, 'https://example.test/once')))
  const actor = await createOwner()

  await expect(deletePage(otherSite.siteId, actor, { pageId: page!.id })).rejects.toMatchObject({
    code: 'PAGE_NOT_FOUND',
    status: 404,
  })
  await deletePage(siteId, actor, { pageId: page!.id })
  await expect(deletePage(siteId, actor, { pageId: page!.id })).rejects.toMatchObject({
    code: 'PAGE_NOT_FOUND',
    status: 404,
  })
})

test('a page can be deleted by its pageKey or its URL', async () => {
  const { siteKey, siteId } = await createSite()
  const actor = await createOwner()

  await upsertPage(siteKey, { url: 'https://example.test/by-key', pageKey: 'by-key-page' })
  expect(await deletePage(siteId, actor, { pageKey: 'by-key-page' })).toEqual({
    deleted: true,
    comments: 0,
    replies: 0,
    votes: 0,
  })

  await upsertPage(siteKey, { url: 'https://example.test/by-url' })
  expect(await deletePage(siteId, actor, { url: 'https://example.test/by-url' })).toMatchObject({ deleted: true })
})

test('the pages:delete scope maps to the delete permission and is refused on unbound instance-only sets', () => {
  expect(scopesToPermissions(['pages:delete'])).toEqual({ pages: ['delete'] })
  expect(() => assertValidScopeSet('some-site', ['pages:delete', 'pages:write'])).not.toThrow()
  expect(() => assertValidScopeSet(null, ['pages:delete'])).toThrow()
})
