import { afterAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { comments, pages, siteOrigins, sites } from '@/server/db/schema'
import { upsertPage } from '@/server/modules/comments/infrastructure/comment-pages'
import { listPageComments } from '@/server/modules/comments/infrastructure/comment-reads'
import {
  deletePage,
  setCommentStatus,
  setPageLocked,
} from '@/server/modules/comments/infrastructure/moderation-actions'
import {
  listModerationComments,
  listModerationTakedowns,
  listSiteUsers,
  listUserComments,
} from '@/server/modules/comments/infrastructure/moderation-queries'
import { deleteOwnComment, editOwnComment } from '@/server/modules/comments/infrastructure/comment-writes'
import { castCommentVote, clearCommentVote } from '@/server/modules/comments/infrastructure/comment-votes'
import { getPageThread } from '@/server/modules/comments/infrastructure/stats-queries'
import { cleanupTestData, createOwner, createTestComment, siteKeys } from './helpers/integration'

// Tenancy matrix: a request that names site B must never reach site A's comment or page, through any
// repository entry point. Each case checks the refusal and that site A's data is unchanged afterwards.
const db = getBusinessDb()
afterAll(cleanupTestData)

async function makeSite(label: string) {
  const key = `tenancy-${label}-${crypto.randomUUID()}`
  siteKeys.push(key)
  const origin = `https://${label}.tenancy.example.test`
  const [site] = await db
    .insert(sites)
    .values({ key, name: `Tenancy ${label}` })
    .returning({ id: sites.id })
  await db.insert(siteOrigins).values({ siteId: site!.id, origin })
  return { key, id: site!.id, origin }
}

async function setup() {
  const a = await makeSite('a')
  const b = await makeSite('b')
  const pageUrl = `${a.origin}/post`
  const guest = await createTestComment({
    siteKey: a.key,
    pageUrl,
    userId: null,
    authorName: 'Guest',
    bodyMarkdown: 'Guest on A',
  })
  const author = await createOwner('Tenancy author')
  const signedIn = await createTestComment({
    siteKey: a.key,
    pageUrl,
    userId: author,
    authorName: 'Author',
    bodyMarkdown: 'Author on A',
  })
  const [page] = await db.select({ id: pages.id }).from(pages).where(eq(pages.canonicalUrl, pageUrl))
  const actor = await createOwner('Tenancy actor')
  const voter = await createOwner('Tenancy voter')
  return { a, b, pageUrl, pageId: page!.id, guest, signedIn, author, actor, voter }
}

async function commentRow(commentId: string) {
  const [row] = await db
    .select({ status: comments.status, body: comments.bodyMarkdown, siteId: comments.siteId })
    .from(comments)
    .where(eq(comments.id, commentId))
  return row
}

describe('tenancy: a request for site B never reaches site A', () => {
  test('a comment records the site of its page', async () => {
    const { a, guest } = await setup()
    expect((await commentRow(guest.id))?.siteId).toBe(a.id)
  })

  test('the database refuses a comment whose page belongs to another site', async () => {
    const { b, pageId } = await setup()
    // The insert builder only runs when awaited, so hand it to expect as a promise.
    await expect(
      Promise.resolve(
        db.insert(comments).values({ siteId: b.id, pageId, authorName: 'Intruder', bodyMarkdown: 'nope' }),
      ),
    ).rejects.toThrow()
  })

  test('moderation through site B cannot hide, delete or pin site A’s comment', async () => {
    const { b, guest, actor } = await setup()
    for (const action of ['hide', 'delete', 'pin'] as const) {
      await expect(setCommentStatus(b.id, actor, guest.id, action)).rejects.toMatchObject({ status: 404 })
    }
    expect(await commentRow(guest.id)).toMatchObject({ status: 'visible', body: 'Guest on A' })
  })

  test('an edit or delete through site B fails even with the right edit key', async () => {
    const { b, guest } = await setup()
    await expect(
      editOwnComment({
        siteKey: b.key,
        commentId: guest.id,
        userId: null,
        bodyMarkdown: 'changed',
        editKey: guest.editKey!,
      }),
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      deleteOwnComment({ siteKey: b.key, commentId: guest.id, userId: null, editKey: guest.editKey! }),
    ).rejects.toMatchObject({ status: 404 })
    expect(await commentRow(guest.id)).toMatchObject({ status: 'visible', body: 'Guest on A' })
  })

  test('an author on site B cannot delete site A’s signed-in comment', async () => {
    const { b, signedIn, author } = await setup()
    await expect(deleteOwnComment({ siteKey: b.key, commentId: signedIn.id, userId: author })).rejects.toMatchObject({
      status: 404,
    })
    expect(await commentRow(signedIn.id)).toMatchObject({ status: 'visible' })
  })

  test('a vote through site B neither casts nor clears a vote on site A’s comment', async () => {
    const { b, guest, voter } = await setup()
    await expect(castCommentVote(b.key, guest.id, voter, 1)).rejects.toMatchObject({ status: 404 })
    await expect(clearCommentVote(b.key, guest.id, voter)).rejects.toMatchObject({ status: 404 })
  })

  test('locking and deleting a page through site B leave site A’s page alone', async () => {
    const { b, pageId, pageUrl, actor } = await setup()
    await expect(setPageLocked(b.id, actor, pageId, true)).rejects.toMatchObject({ status: 404 })
    await expect(deletePage(b.id, actor, { pageId })).rejects.toMatchObject({ status: 404 })
    const [page] = await db.select({ isLocked: pages.isLocked }).from(pages).where(eq(pages.canonicalUrl, pageUrl))
    expect(page?.isLocked).toBe(false)
  })

  test('reads through site B return nothing from site A, even after A hides a comment', async () => {
    const { a, b, pageId, pageUrl, guest, author, actor } = await setup()
    await setCommentStatus(a.id, actor, guest.id, 'hide')

    expect(await listPageComments(b.key, pageUrl, { limit: 20, offset: 0 })).toEqual([])
    await expect(getPageThread(b.id, pageId, 7)).rejects.toMatchObject({ status: 404 })
    expect((await listModerationComments(b.id, { pageId, limit: 20, offset: 0 })).total).toBe(0)
    expect((await listModerationTakedowns(b.id, { recentDays: 0, limit: 20, offset: 0 })).total).toBe(0)
    expect((await listUserComments(b.id, author, { limit: 20, offset: 0 })).total).toBe(0)
    const users = await listSiteUsers(b.id, { limit: 20, offset: 0 })
    expect(users.users.map((user) => user.userId)).not.toContain(author)

    // Site A still sees its own takedown, so the empty results above are tenancy, not a broken query.
    expect((await listModerationTakedowns(a.id, { recentDays: 0, limit: 20, offset: 0 })).total).toBe(1)
  })

  test('a page URL on site A’s origin cannot be opened through site B', async () => {
    const { b, pageUrl } = await setup()
    await expect(upsertPage(b.key, { url: pageUrl })).rejects.toMatchObject({
      status: 400,
      code: 'PAGE_ORIGIN_NOT_ALLOWED',
    })
  })
})
