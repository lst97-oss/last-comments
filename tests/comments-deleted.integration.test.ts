import { afterAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { updateAdminSite } from '@/server/modules/admin/infrastructure/admin-repository'
import { getBusinessDb } from '@/server/db/business-sql'
import { comments, sites } from '@/server/db/schema'
import {
  castCommentVote,
  clearCommentVote,
  deleteOwnComment,
  listPageComments,
  setCommentStatus,
} from '@/server/modules/comments/infrastructure/comment-repository'
import { cleanupTestData, createOwner, createTestComment, siteKeys } from './helpers/integration'

const db = getBusinessDb()

afterAll(cleanupTestData)

async function setupSite(prefix: string) {
  const siteKey = `${prefix}-${crypto.randomUUID()}`
  siteKeys.push(siteKey)
  await db.insert(sites).values({ key: siteKey, name: prefix })
  const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey))
  return { siteKey, siteId: site!.id }
}

describe('deleted comments stay in the thread', () => {
  test('a deleted comment and its reply come back, the comment redacted and the reply intact', async () => {
    const { siteKey } = await setupSite('deleted-thread')
    const pageUrl = 'https://example.test/deleted-thread'
    const parent = await createTestComment({
      siteKey,
      pageUrl,
      userId: null,
      authorName: 'Ada',
      bodyMarkdown: 'Parent body',
    })
    const reply = await createTestComment({
      siteKey,
      pageUrl,
      userId: null,
      authorName: 'Ben',
      bodyMarkdown: 'A reply',
      parentId: parent.id,
    })
    const voter = await createOwner('Voter')
    await castCommentVote(siteKey, parent.id, voter, 1)

    await deleteOwnComment({ siteKey, commentId: parent.id, userId: null, editKey: parent.editKey! })

    const rows = await listPageComments(siteKey, pageUrl, { limit: 20, offset: 0 })
    expect(rows.map((row) => row.id)).toEqual([parent.id, reply.id])
    expect(rows[0]).toMatchObject({
      status: 'deleted',
      bodyMarkdown: '',
      authorName: '',
      userId: null,
      avatarUrl: null,
      authorRole: null,
      score: 0,
      viewerVote: null,
    })
    expect(rows[1]).toMatchObject({ parentId: parent.id, status: 'visible', bodyMarkdown: 'A reply' })
  })

  test('a hidden comment is still left out of the public list', async () => {
    const { siteKey, siteId } = await setupSite('hidden-thread')
    const pageUrl = 'https://example.test/hidden-thread'
    const hidden = await createTestComment({
      siteKey,
      pageUrl,
      userId: null,
      authorName: 'Ada',
      bodyMarkdown: 'Hold me',
    })
    const moderator = await createOwner('Moderator')
    await setCommentStatus(siteId, moderator, hidden.id, 'hide')
    expect(await listPageComments(siteKey, pageUrl, { limit: 20, offset: 0 })).toHaveLength(0)
  })

  test('a moderator restore brings the original body back', async () => {
    const { siteKey, siteId } = await setupSite('restore-thread')
    const pageUrl = 'https://example.test/restore-thread'
    const parent = await createTestComment({
      siteKey,
      pageUrl,
      userId: null,
      authorName: 'Ada',
      bodyMarkdown: 'Keep me',
    })
    await deleteOwnComment({ siteKey, commentId: parent.id, userId: null, editKey: parent.editKey! })
    const moderator = await createOwner('Moderator')
    await setCommentStatus(siteId, moderator, parent.id, 'restore')
    const [row] = await listPageComments(siteKey, pageUrl, { limit: 20, offset: 0 })
    expect(row).toMatchObject({ status: 'visible', bodyMarkdown: 'Keep me', authorName: 'Ada' })
  })
})

describe('guest delete', () => {
  test('a guest deletes with the edit key, with no time window, and a second delete finds nothing', async () => {
    const { siteKey } = await setupSite('guest-delete')
    const guest = await createTestComment({
      siteKey,
      pageUrl: 'https://example.test/guest-delete',
      userId: null,
      authorName: 'Guest',
      bodyMarkdown: 'Old comment',
    })
    await db
      .update(comments)
      .set({ createdAt: new Date(Date.now() - 3 * 24 * 60 * 60_000) })
      .where(eq(comments.id, guest.id))

    const deleted = await deleteOwnComment({ siteKey, commentId: guest.id, userId: null, editKey: guest.editKey! })
    expect(deleted.status).toBe('deleted')
    await expect(
      deleteOwnComment({ siteKey, commentId: guest.id, userId: null, editKey: guest.editKey! }),
    ).rejects.toMatchObject({ code: 'COMMENT_NOT_FOUND', status: 404 })
  })

  test('a wrong edit key cannot delete, and a guest key cannot reach a signed-in author’s comment', async () => {
    const { siteKey } = await setupSite('guest-delete-scope')
    const pageUrl = 'https://example.test/guest-delete-scope'
    const guest = await createTestComment({
      siteKey,
      pageUrl,
      userId: null,
      authorName: 'Guest',
      bodyMarkdown: 'Guest',
    })
    const author = await createOwner('Author')
    const owned = await createTestComment({
      siteKey,
      pageUrl,
      userId: author,
      authorName: 'Author',
      bodyMarkdown: 'Signed in',
    })

    await expect(
      deleteOwnComment({ siteKey, commentId: guest.id, userId: null, editKey: 'not-the-key' }),
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      deleteOwnComment({ siteKey, commentId: owned.id, userId: null, editKey: guest.editKey! }),
    ).rejects.toMatchObject({ status: 404 })
    expect((await listPageComments(siteKey, pageUrl, { limit: 20, offset: 0 })).map((row) => row.status)).toEqual([
      'visible',
      'visible',
    ])
  })
})

describe('the vote switch', () => {
  test('turning voting off refuses votes on both paths and keeps the votes already cast', async () => {
    const { siteKey } = await setupSite('vote-switch')
    const pageUrl = 'https://example.test/vote-switch'
    const comment = await createTestComment({
      siteKey,
      pageUrl,
      userId: null,
      authorName: 'Guest',
      bodyMarkdown: 'Vote me',
    })
    const voter = await createOwner('Voter')
    await castCommentVote(siteKey, comment.id, voter, 1)

    await updateAdminSite(siteKey, { votesEnabled: false })
    await expect(castCommentVote(siteKey, comment.id, voter, -1)).rejects.toMatchObject({
      code: 'FEATURE_DISABLED',
      status: 403,
    })
    await expect(clearCommentVote(siteKey, comment.id, voter)).rejects.toMatchObject({ code: 'FEATURE_DISABLED' })
    expect((await listPageComments(siteKey, pageUrl, { limit: 20, offset: 0 }))[0]).toMatchObject({ score: 1 })

    await updateAdminSite(siteKey, { votesEnabled: true })
    await expect(clearCommentVote(siteKey, comment.id, voter)).resolves.toEqual({ score: 0, viewerVote: null })
  })
})
