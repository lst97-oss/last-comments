import { afterAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { comments, pages, siteMemberships, sites, user, userBlocks, votes } from '@/server/db/schema'
import {
  deleteOwnComment,
  editOwnComment,
  getPageCanonicalUrl,
  getSiteId,
  listModerationComments,
  listModerationPages,
  listPageComments,
} from '@/server/modules/comments/infrastructure/comment-repository'
import { cleanupTestData, createOwner, createTestComment, siteKeys, userIds } from './helpers/integration'

const db = getBusinessDb()

afterAll(cleanupTestData)

describe('business comments', () => {
  test('persists guest comments and replies in the business database', async () => {
    const siteKey = `test-${crypto.randomUUID()}`
    siteKeys.push(siteKey)
    await db.insert(sites).values({ key: siteKey, name: 'Test site' })

    const parent = await createTestComment({
      siteKey,
      pageUrl: 'https://example.test/article#comments',
      userId: null,
      authorName: 'Guest author',
      bodyMarkdown: 'First comment',
    })
    const reply = await createTestComment({
      siteKey,
      pageUrl: 'https://example.test/article',
      parentId: parent.id,
      userId: null,
      authorName: 'Another guest',
      bodyMarkdown: 'A reply',
    })

    expect(reply.parentId).toBe(parent.id)
    expect(await listPageComments(siteKey, 'https://example.test/article', { limit: 20, offset: 0 })).toHaveLength(2)
  })
})

describe('business comment author role', () => {
  test('resolves the site membership role on create, edit and both list shapes', async () => {
    const siteKey = `author-role-${crypto.randomUUID()}`
    siteKeys.push(siteKey)
    await db.insert(sites).values({ key: siteKey, name: 'Role site' })
    const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey))
    const adminId = await createOwner('Admin author')
    const moderatorId = await createOwner('Moderator author')
    await db.insert(siteMemberships).values([
      { siteId: site!.id, userId: adminId, role: 'admin' },
      { siteId: site!.id, userId: moderatorId, role: 'moderator' },
    ])

    const admin = await createTestComment({
      siteKey,
      pageUrl: 'https://example.test/roles',
      userId: adminId,
      authorName: 'Admin author',
      bodyMarkdown: 'Admin comment',
    })
    const moderator = await createTestComment({
      siteKey,
      pageUrl: 'https://example.test/roles',
      userId: moderatorId,
      authorName: 'Moderator author',
      bodyMarkdown: 'Moderator comment',
    })
    const guest = await createTestComment({
      siteKey,
      pageUrl: 'https://example.test/roles',
      userId: null,
      authorName: 'Guest author',
      bodyMarkdown: 'Guest comment',
    })

    expect(admin.authorRole).toBe('admin')
    expect(moderator.authorRole).toBe('moderator')
    expect(guest.authorRole).toBeNull()

    const edited = await editOwnComment({
      siteKey,
      commentId: admin.id,
      userId: adminId,
      bodyMarkdown: 'Admin edit',
    })
    expect(edited.authorRole).toBe('admin')

    const roles = (rows: { authorName: string; authorRole: string | null }[]) =>
      Object.fromEntries(rows.map((row) => [row.authorName, row.authorRole]))
    const expected = { 'Admin author': 'admin', 'Moderator author': 'moderator', 'Guest author': null }
    expect(roles(await listPageComments(siteKey, 'https://example.test/roles', { limit: 20, offset: 0 }))).toEqual(
      expected,
    )
    expect(roles((await listModerationComments(site!.id, { limit: 20, offset: 0 })).comments)).toEqual(expected)
  })
})

describe('business comment edit window', () => {
  test('lets signed-in authors edit any time and guests edit with the issued key inside the window', async () => {
    const siteKey = `edit-window-${crypto.randomUUID()}`
    const authorId = crypto.randomUUID()
    siteKeys.push(siteKey)
    userIds.push(authorId)
    await db.insert(sites).values({ key: siteKey, name: 'Edit window site' })
    await db.insert(user).values([{ id: authorId, name: 'Author', email: `${authorId}@test.invalid` }])
    const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey))
    const [page] = await db
      .insert(pages)
      .values({ siteId: site!.id, canonicalUrl: 'https://example.test/edit-window' })
      .returning({ id: pages.id })
    const [fresh] = await db
      .insert(comments)
      .values({ pageId: page!.id, userId: authorId, authorName: 'Author', bodyMarkdown: 'Fresh' })
      .returning({ id: comments.id })
    const [stale] = await db
      .insert(comments)
      .values({
        pageId: page!.id,
        userId: authorId,
        authorName: 'Author',
        bodyMarkdown: 'Stale',
        createdAt: new Date(Date.now() - 6 * 60_000),
      })
      .returning({ id: comments.id })

    const edited = await editOwnComment({
      siteKey,
      commentId: fresh!.id,
      userId: authorId,
      bodyMarkdown: 'Fresh v2',
    })
    expect(edited.bodyMarkdown).toBe('Fresh v2')
    expect(edited.editedAt).not.toBeNull()

    // Signed-in authors have no window: the 5-minute setting no longer applies.
    const unlimited = await editOwnComment({
      siteKey,
      commentId: stale!.id,
      userId: authorId,
      bodyMarkdown: 'Signed in v2',
    })
    expect(unlimited.bodyMarkdown).toBe('Signed in v2')

    const guest = await createTestComment({
      siteKey,
      pageUrl: 'https://example.test/edit-window',
      userId: null,
      authorName: 'Guest',
      bodyMarkdown: 'Guest',
    })
    expect(typeof guest.editKey).toBe('string')
    expect('editKeyHash' in guest).toBe(false)

    const guestEdit = await editOwnComment({
      siteKey,
      commentId: guest.id,
      userId: null,
      editKey: guest.editKey!,
      bodyMarkdown: 'Guest v2',
    })
    expect(guestEdit.bodyMarkdown).toBe('Guest v2')

    await expect(
      editOwnComment({ siteKey, commentId: guest.id, userId: null, editKey: 'wrong-key', bodyMarkdown: 'Nope' }),
    ).rejects.toMatchObject({ code: 'COMMENT_NOT_FOUND', status: 404 })

    await db
      .update(comments)
      .set({ createdAt: new Date(Date.now() - 11 * 60_000) })
      .where(eq(comments.id, guest.id))
    await expect(
      editOwnComment({ siteKey, commentId: guest.id, userId: null, editKey: guest.editKey!, bodyMarkdown: 'Late' }),
    ).rejects.toMatchObject({ code: 'EDIT_WINDOW_EXPIRED', status: 403 })

    const guestUnlimited = await editOwnComment({
      siteKey,
      commentId: guest.id,
      userId: null,
      editKey: guest.editKey!,
      anonWindowMinutes: 0,
      bodyMarkdown: 'Guest v3',
    })
    expect(guestUnlimited.bodyMarkdown).toBe('Guest v3')

    const deleted = await deleteOwnComment({ siteKey, commentId: stale!.id, userId: authorId })
    expect(deleted.status).toBe('deleted')
  })

  test('exposes signed-in author avatars and leaves guest comments without one', async () => {
    const siteKey = `avatar-${crypto.randomUUID()}`
    const authorId = crypto.randomUUID()
    siteKeys.push(siteKey)
    userIds.push(authorId)
    await db.insert(sites).values({ key: siteKey, name: 'Avatar site' })
    await db
      .insert(user)
      .values([
        { id: authorId, name: 'Author', email: `${authorId}@test.invalid`, image: 'https://cdn.example/me.png' },
      ])
    await createTestComment({
      siteKey,
      pageUrl: 'https://example.test/avatar',
      userId: authorId,
      authorName: 'Author',
      bodyMarkdown: 'Signed in',
    })
    await createTestComment({
      siteKey,
      pageUrl: 'https://example.test/avatar',
      userId: null,
      authorName: 'Guest',
      bodyMarkdown: 'Guest',
    })

    const rows = await listPageComments(siteKey, 'https://example.test/avatar', { limit: 20, offset: 0 })
    expect(rows.map((row) => row.avatarUrl)).toEqual(['https://cdn.example/me.png', null])
  })
})

describe('business comment votes', () => {
  test('casts, switches, clears, and reports votes per signed-in user', async () => {
    const repository = (await import(
      '@/server/modules/comments/infrastructure/comment-repository'
    )) as typeof import('@/server/modules/comments/infrastructure/comment-repository') & {
      castCommentVote: (
        siteKey: string,
        commentId: string,
        userId: string,
        value: -1 | 1,
      ) => Promise<{ score: number; viewerVote: -1 | 1 | null }>
      clearCommentVote: (
        siteKey: string,
        commentId: string,
        userId: string,
      ) => Promise<{ score: number; viewerVote: -1 | 1 | null }>
    }
    const siteKey = `vote-${crypto.randomUUID()}`
    const voterId = crypto.randomUUID()
    const otherVoterId = crypto.randomUUID()
    siteKeys.push(siteKey)
    userIds.push(voterId, otherVoterId)
    await db.insert(sites).values({ key: siteKey, name: 'Voting test site' })
    await db.insert(user).values([
      { id: voterId, name: 'Voter', email: `${voterId}@test.invalid` },
      { id: otherVoterId, name: 'Other voter', email: `${otherVoterId}@test.invalid` },
    ])
    const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey))
    const [page] = await db
      .insert(pages)
      .values({ siteId: site!.id, canonicalUrl: 'https://example.test/votes' })
      .returning({ id: pages.id })
    const [comment] = await db
      .insert(comments)
      .values({ pageId: page!.id, authorName: 'Guest', bodyMarkdown: 'Vote on this' })
      .returning({ id: comments.id })

    await expect(
      listPageComments(siteKey, 'https://example.test/votes', { limit: 20, offset: 0, viewerUserId: voterId }),
    ).resolves.toMatchObject([{ score: 0, viewerVote: null }])

    await expect(repository.castCommentVote(siteKey, comment!.id, voterId, 1)).resolves.toEqual({
      score: 1,
      viewerVote: 1,
    })
    await expect(repository.castCommentVote(siteKey, comment!.id, otherVoterId, -1)).resolves.toEqual({
      score: 0,
      viewerVote: -1,
    })
    await expect(repository.castCommentVote(siteKey, comment!.id, voterId, -1)).resolves.toEqual({
      score: -2,
      viewerVote: -1,
    })
    await expect(repository.clearCommentVote(siteKey, comment!.id, voterId)).resolves.toEqual({
      score: -1,
      viewerVote: null,
    })
    await expect(repository.clearCommentVote(siteKey, comment!.id, voterId)).resolves.toEqual({
      score: -1,
      viewerVote: null,
    })

    await expect(
      listPageComments(siteKey, 'https://example.test/votes', { limit: 20, offset: 0, viewerUserId: otherVoterId }),
    ).resolves.toMatchObject([{ score: -1, viewerVote: -1 }])
    expect(await db.select().from(votes).where(eq(votes.commentId, comment!.id))).toHaveLength(1)
  })

  test('rejects blocked users, locked pages, and comments outside the requested site', async () => {
    const repository = (await import(
      '@/server/modules/comments/infrastructure/comment-repository'
    )) as typeof import('@/server/modules/comments/infrastructure/comment-repository') & {
      castCommentVote: (
        siteKey: string,
        commentId: string,
        userId: string,
        value: -1 | 1,
      ) => Promise<{ score: number; viewerVote: -1 | 1 | null }>
    }
    expect(typeof repository.castCommentVote).toBe('function')
    const siteKey = `vote-block-${crypto.randomUUID()}`
    const otherSiteKey = `vote-other-${crypto.randomUUID()}`
    const voterId = crypto.randomUUID()
    const moderatorId = crypto.randomUUID()
    siteKeys.push(siteKey, otherSiteKey)
    userIds.push(voterId, moderatorId)
    await db.insert(sites).values([
      { key: siteKey, name: 'Voting site' },
      { key: otherSiteKey, name: 'Other voting site' },
    ])
    await db.insert(user).values([
      { id: voterId, name: 'Blocked voter', email: `${voterId}@test.invalid` },
      { id: moderatorId, name: 'Moderator', email: `${moderatorId}@test.invalid` },
    ])
    const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey))
    const [page] = await db
      .insert(pages)
      .values({ siteId: site!.id, canonicalUrl: 'https://example.test/vote-policy' })
      .returning({ id: pages.id })
    const [comment] = await db
      .insert(comments)
      .values({ pageId: page!.id, authorName: 'Guest', bodyMarkdown: 'Vote policy' })
      .returning({ id: comments.id })

    await db.insert(userBlocks).values({ siteId: site!.id, userId: voterId, createdByUserId: moderatorId })
    await expect(repository.castCommentVote(siteKey, comment!.id, voterId, 1)).rejects.toMatchObject({
      code: 'USER_BLOCKED',
    })
    await expect(repository.castCommentVote(otherSiteKey, comment!.id, moderatorId, 1)).rejects.toMatchObject({
      code: 'COMMENT_NOT_FOUND',
    })

    await db
      .update(userBlocks)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(userBlocks.userId, voterId))
    await db.update(pages).set({ isLocked: true }).where(eq(pages.id, page!.id))
    await expect(repository.castCommentVote(siteKey, comment!.id, voterId, 1)).rejects.toMatchObject({
      code: 'PAGE_LOCKED',
    })
    await db.update(pages).set({ isLocked: false }).where(eq(pages.id, page!.id))
    await db.update(comments).set({ status: 'hidden' }).where(eq(comments.id, comment!.id))
    await expect(repository.castCommentVote(siteKey, comment!.id, voterId, 1)).rejects.toMatchObject({
      code: 'COMMENT_NOT_FOUND',
    })
  })
})

describe('moderation pages and paging', () => {
  test('lists page summaries with counts and paginates comments by page', async () => {
    const siteKey = `mod-pages-${crypto.randomUUID()}`
    siteKeys.push(siteKey)
    await db.insert(sites).values({ key: siteKey, name: 'Moderation pages site' })
    const siteId = await getSiteId(siteKey)
    const [siteRow] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey))
    const [pageA] = await db
      .insert(pages)
      .values({ siteId: siteRow!.id, canonicalUrl: 'https://example.test/post-a', title: 'Post A' })
      .returning({ id: pages.id })
    const [pageB] = await db
      .insert(pages)
      .values({ siteId: siteRow!.id, canonicalUrl: 'https://example.test/post-b', title: 'Post B' })
      .returning({ id: pages.id })
    const [pageC] = await db
      .insert(pages)
      .values({ siteId: siteRow!.id, canonicalUrl: 'https://example.test/post-c', title: 'Post C' })
      .returning({ id: pages.id })
    const t0 = new Date('2026-01-01T00:00:00Z').getTime()
    const at = (seconds: number) => new Date(t0 + seconds * 1_000)
    await db.insert(comments).values([
      { pageId: pageA!.id, authorName: 'A1', bodyMarkdown: 'first', createdAt: at(0) },
      { pageId: pageA!.id, authorName: 'A2', bodyMarkdown: 'second', status: 'hidden', createdAt: at(1) },
      { pageId: pageA!.id, authorName: 'A3', bodyMarkdown: 'third', createdAt: at(2) },
      { pageId: pageB!.id, authorName: 'B1', bodyMarkdown: 'only', createdAt: at(3) },
    ])

    const summaries = await listModerationPages(siteId)
    expect(summaries).toHaveLength(3)
    expect(summaries[0]).toMatchObject({
      id: pageB!.id,
      latest: { authorName: 'B1', bodyMarkdown: 'only', status: 'visible' },
    })
    expect(summaries[0]!.latest!.createdAt).toEqual(at(3))
    // The newest comment wins over the hidden one: latest tracks activity, not
    // visibility, and a comment-less thread previews nothing.
    expect(summaries[1]).toMatchObject({
      id: pageA!.id,
      total: 3,
      visible: 2,
      hidden: 1,
      latest: { authorName: 'A3', bodyMarkdown: 'third', status: 'visible' },
    })
    expect(summaries[1]!.latest!.createdAt).toEqual(at(2))
    expect(summaries[2]).toMatchObject({ id: pageC!.id, latestAt: null, latest: null })

    const filtered = await listModerationComments(siteId, { pageId: pageB!.id, limit: 20, offset: 0 })
    expect(filtered.total).toBe(1)
    expect(filtered.comments).toHaveLength(1)
    expect(filtered.comments[0]!.authorName).toBe('B1')

    const newest = await listModerationComments(siteId, { limit: 2, offset: 0 })
    expect(newest.total).toBe(4)
    expect(newest.comments.map((c) => c.authorName)).toEqual(['B1', 'A3'])

    const oldest = await listModerationComments(siteId, { sort: 'oldest', limit: 2, offset: 0 })
    expect(oldest.comments.map((c) => c.authorName)).toEqual(['A1', 'A2'])

    const hidden = await listModerationComments(siteId, { status: 'hidden', limit: 20, offset: 0 })
    expect(hidden.total).toBe(1)
    expect(hidden.comments.map((c) => c.authorName)).toEqual(['A2'])
  })

  test('rolls up recent-window counts, authors and capped previews', async () => {
    const siteKey = `recent-${crypto.randomUUID()}`
    siteKeys.push(siteKey)
    await db.insert(sites).values({ key: siteKey, name: 'Recent site' })
    const siteId = await getSiteId(siteKey)
    const [siteRow] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey))
    const [busy] = await db
      .insert(pages)
      .values({ siteId: siteRow!.id, canonicalUrl: 'https://example.test/recent-busy' })
      .returning({ id: pages.id })
    const [quiet] = await db
      .insert(pages)
      .values({ siteId: siteRow!.id, canonicalUrl: 'https://example.test/recent-quiet' })
      .returning({ id: pages.id })
    const now = Date.now()
    const ago = (ms: number) => new Date(now - ms)
    await db.insert(comments).values([
      { pageId: busy!.id, authorName: 'Amy', bodyMarkdown: 'one', createdAt: ago(50 * 60_000) },
      { pageId: busy!.id, authorName: 'Bo', bodyMarkdown: 'two', createdAt: ago(40 * 60_000) },
      // Hidden rows count for moderators: the window tracks activity, not visibility.
      { pageId: busy!.id, authorName: 'Amy', bodyMarkdown: 'three', status: 'hidden', createdAt: ago(30 * 60_000) },
      { pageId: busy!.id, authorName: 'Cy', bodyMarkdown: 'four', createdAt: ago(20 * 60_000) },
      { pageId: busy!.id, authorName: 'Dee', bodyMarkdown: 'five', createdAt: ago(10 * 60_000) },
      // Stale rows stay out of a 7-day window but keep their latest preview.
      { pageId: quiet!.id, authorName: 'Old', bodyMarkdown: 'stale', createdAt: ago(10 * 86_400_000) },
    ])

    const summaries = await listModerationPages(siteId, { recentDays: 7, previewLimit: 3 })
    expect(summaries).toHaveLength(2)
    const busySummary = summaries.find((summary) => summary.id === busy!.id)!
    expect(busySummary.recent).toMatchObject({ windowDays: 7, count: 5, totalAuthors: 4 })
    // Amy wrote twice so she leads; single-comment authors break ties alphabetically.
    expect(busySummary.recent.authors).toEqual([
      { authorName: 'Amy', count: 2 },
      { authorName: 'Bo', count: 1 },
      { authorName: 'Cy', count: 1 },
    ])
    // Newest first, capped at the preview limit even though five updates exist.
    expect(busySummary.recent.preview.map((comment) => comment.authorName)).toEqual(['Dee', 'Cy', 'Amy'])
    const quietSummary = summaries.find((summary) => summary.id === quiet!.id)!
    expect(quietSummary.recent).toEqual({ windowDays: 7, count: 0, totalAuthors: 0, authors: [], preview: [] })
    expect(quietSummary.latest).toMatchObject({ authorName: 'Old' })

    const day = await listModerationPages(siteId, { recentDays: 1, previewLimit: 2 })
    const busyDay = day.find((summary) => summary.id === busy!.id)!
    expect(busyDay.recent).toMatchObject({ windowDays: 1, count: 5 })
    expect(busyDay.recent.preview).toHaveLength(2)
  })

  test('carries vote state for the requesting moderator', async () => {
    const siteKey = `mod-votes-${crypto.randomUUID()}`
    siteKeys.push(siteKey)
    const viewerId = crypto.randomUUID()
    const otherId = crypto.randomUUID()
    userIds.push(viewerId, otherId)
    await db.insert(sites).values({ key: siteKey, name: 'Moderation votes site' })
    await db.insert(user).values([
      { id: viewerId, name: 'Viewer', email: `${viewerId}@test.invalid` },
      { id: otherId, name: 'Other', email: `${otherId}@test.invalid` },
    ])
    const siteId = await getSiteId(siteKey)
    const [siteRow] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey))
    const [page] = await db
      .insert(pages)
      .values({ siteId: siteRow!.id, canonicalUrl: 'https://example.test/mod-votes' })
      .returning({ id: pages.id })
    const [comment] = await db
      .insert(comments)
      .values({ pageId: page!.id, authorName: 'Ada', bodyMarkdown: 'Vote me' })
      .returning({ id: comments.id })
    await db.insert(votes).values([
      { commentId: comment!.id, userId: viewerId, value: 1 },
      { commentId: comment!.id, userId: otherId, value: -1 },
    ])

    const withViewer = await listModerationComments(siteId, { viewerUserId: viewerId, limit: 20, offset: 0 })
    // Sum of both votes, with the viewer's own vote read back per row.
    expect(withViewer.comments[0]).toMatchObject({ score: 0, viewerVote: 1 })
    const anonymousViewer = await listModerationComments(siteId, { limit: 20, offset: 0 })
    expect(anonymousViewer.comments[0]).toMatchObject({ score: 0, viewerVote: null })
  })
})

describe('moderator page addressing', () => {
  test('resolves the thread URL inside the moderator site only', async () => {
    const siteKey = `moderator-page-${crypto.randomUUID()}`
    siteKeys.push(siteKey)
    await db.insert(sites).values({ key: siteKey, name: 'Moderator page site' })
    const siteId = await getSiteId(siteKey)
    const [page] = await db
      .insert(pages)
      .values({ siteId, canonicalUrl: 'https://example.test/moderator-thread' })
      .returning({ id: pages.id })

    expect(await getPageCanonicalUrl(siteId, page!.id)).toBe('https://example.test/moderator-thread')
    expect(await getPageCanonicalUrl(siteId, crypto.randomUUID())).toBeNull()
    expect(await getPageCanonicalUrl(crypto.randomUUID(), page!.id)).toBeNull()
  })
})
