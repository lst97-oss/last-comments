import { afterAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import {
  commentReactions,
  comments,
  pageReactions,
  pages,
  pluginEvents,
  sites,
  user,
  userBlocks,
} from '@/server/db/schema'
import { listPageComments } from '@/server/modules/comments/infrastructure/comment-reads'
import {
  addCommentReaction,
  addPageReaction,
  listPageReactions,
  removeCommentReaction,
  removePageReaction,
} from '@/server/modules/comments/infrastructure/comment-reactions'
import { cleanupTestData, createOwner, siteKeys } from './helpers/integration'

const db = getBusinessDb()
const PAGE_URL = 'https://example.test/reactions'

afterAll(cleanupTestData)

async function seed(flags: { pageReactionsEnabled?: boolean; commentReactionsEnabled?: boolean } = {}) {
  const siteKey = `reactions-${crypto.randomUUID()}`
  siteKeys.push(siteKey)
  await db.insert(sites).values({ key: siteKey, name: 'Reactions test', ...flags })
  const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey))
  const [page] = await db.insert(pages).values({ siteId: site!.id, canonicalUrl: PAGE_URL }).returning({ id: pages.id })
  const [comment] = await db
    .insert(comments)
    .values({ siteId: site!.id, pageId: page!.id, authorName: 'Guest', bodyMarkdown: 'React to this' })
    .returning({ id: comments.id })
  const reactorA = await createOwner('Reactor A')
  const reactorB = await createOwner('Reactor B')
  return { siteKey, siteId: site!.id, pageId: page!.id, commentId: comment!.id, reactorA, reactorB }
}

const list = (siteKey: string, viewerUserId: string | null) =>
  listPageComments(siteKey, PAGE_URL, { limit: 20, offset: 0, viewerUserId })

describe('comment reactions', () => {
  test('a page reaction writes no plugin event while no installed plugin subscribes to it', async () => {
    const { siteKey, siteId, reactorA } = await seed({ pageReactionsEnabled: true })
    await addPageReaction(siteKey, { pageUrl: PAGE_URL }, reactorA, '👍')
    const events = await db.select().from(pluginEvents).where(eq(pluginEvents.siteId, siteId))
    expect(events).toHaveLength(0)
  })

  test('a viewer can hold several emoji on one comment, and each emoji is counted on its own', async () => {
    const { siteKey, commentId, reactorA, reactorB } = await seed({ commentReactionsEnabled: true })

    await expect(addCommentReaction(siteKey, commentId, reactorA, '👍')).resolves.toEqual([
      { emoji: '👍', count: 1, viewerReacted: true },
    ])
    await expect(addCommentReaction(siteKey, commentId, reactorA, '🎉')).resolves.toEqual([
      { emoji: '👍', count: 1, viewerReacted: true },
      { emoji: '🎉', count: 1, viewerReacted: true },
    ])
    // The summary is the whole comment's, as the viewer sees it: B's view includes A's 🎉.
    await expect(addCommentReaction(siteKey, commentId, reactorB, '👍')).resolves.toEqual([
      { emoji: '👍', count: 2, viewerReacted: true },
      { emoji: '🎉', count: 1, viewerReacted: false },
    ])
    // Re-adding the same emoji changes nothing.
    await expect(addCommentReaction(siteKey, commentId, reactorA, '🎉')).resolves.toEqual([
      { emoji: '👍', count: 2, viewerReacted: true },
      { emoji: '🎉', count: 1, viewerReacted: true },
    ])

    const [comment] = await list(siteKey, reactorB)
    expect(comment!.reactions).toEqual([
      { emoji: '👍', count: 2, viewerReacted: true },
      { emoji: '🎉', count: 1, viewerReacted: false },
    ])
    const anonymous = await list(siteKey, null)
    expect(anonymous[0]!.reactions.every((reaction) => reaction.viewerReacted === false)).toBe(true)
  })

  test('removing one emoji leaves the viewer’s other emoji and other viewers’ reactions alone', async () => {
    const { siteKey, commentId, reactorA, reactorB } = await seed({ commentReactionsEnabled: true })
    await addCommentReaction(siteKey, commentId, reactorA, '👍')
    await addCommentReaction(siteKey, commentId, reactorA, '🎉')
    await addCommentReaction(siteKey, commentId, reactorB, '👍')

    await expect(removeCommentReaction(siteKey, commentId, reactorA, '👍')).resolves.toEqual([
      { emoji: '👍', count: 1, viewerReacted: false },
      { emoji: '🎉', count: 1, viewerReacted: true },
    ])
    // Removing a reaction that is not there is a no-op.
    await expect(removeCommentReaction(siteKey, commentId, reactorA, '👍')).resolves.toEqual([
      { emoji: '👍', count: 1, viewerReacted: false },
      { emoji: '🎉', count: 1, viewerReacted: true },
    ])
    const [comment] = await list(siteKey, reactorB)
    expect(comment!.reactions).toEqual([
      { emoji: '👍', count: 1, viewerReacted: true },
      { emoji: '🎉', count: 1, viewerReacted: false },
    ])
  })

  test('refuses a reaction when the feature is off, the page is locked, the viewer is blocked, or the comment is not visible', async () => {
    const off = await seed({ commentReactionsEnabled: false })
    await expect(addCommentReaction(off.siteKey, off.commentId, off.reactorA, '👍')).rejects.toMatchObject({
      code: 'FEATURE_DISABLED',
    })

    const { siteKey, siteId, pageId, commentId, reactorA, reactorB } = await seed({ commentReactionsEnabled: true })
    await db.update(pages).set({ isLocked: true }).where(eq(pages.id, pageId))
    await expect(addCommentReaction(siteKey, commentId, reactorA, '👍')).rejects.toMatchObject({
      code: 'PAGE_LOCKED',
    })
    await db.update(pages).set({ isLocked: false }).where(eq(pages.id, pageId))

    await db.insert(userBlocks).values({ siteId, userId: reactorA, createdByUserId: reactorB })
    await expect(addCommentReaction(siteKey, commentId, reactorA, '👍')).rejects.toMatchObject({
      code: 'USER_BLOCKED',
    })
    await db.delete(userBlocks).where(eq(userBlocks.userId, reactorA))

    await db.update(comments).set({ status: 'hidden' }).where(eq(comments.id, commentId))
    await expect(addCommentReaction(siteKey, commentId, reactorA, '👍')).rejects.toMatchObject({
      code: 'COMMENT_NOT_FOUND',
    })
    await db.update(comments).set({ status: 'visible' }).where(eq(comments.id, commentId))

    const otherSite = await seed({ commentReactionsEnabled: true })
    await expect(addCommentReaction(siteKey, otherSite.commentId, reactorA, '👍')).rejects.toMatchObject({
      code: 'COMMENT_NOT_FOUND',
    })
    expect(await db.select().from(commentReactions).where(eq(commentReactions.commentId, commentId))).toHaveLength(0)
  })

  test('a deleted comment comes back redacted, with no reactions, and its reactions are removed with it', async () => {
    const { siteKey, commentId, reactorA } = await seed({ commentReactionsEnabled: true })
    await addCommentReaction(siteKey, commentId, reactorA, '👍')
    await db.update(comments).set({ status: 'deleted', deletedAt: new Date() }).where(eq(comments.id, commentId))
    const [comment] = await list(siteKey, reactorA)
    expect(comment).toMatchObject({ status: 'deleted', reactions: [] })

    await db.delete(comments).where(eq(comments.id, commentId))
    expect(await db.select().from(commentReactions).where(eq(commentReactions.commentId, commentId))).toHaveLength(0)
  })

  test('counts are reported whether or not the feature is on, as scores are, so a switch-off hides the bar only', async () => {
    const { siteKey, commentId, reactorA } = await seed({ commentReactionsEnabled: true })
    await addCommentReaction(siteKey, commentId, reactorA, '👍')
    await db.update(sites).set({ commentReactionsEnabled: false }).where(eq(sites.key, siteKey))
    const [comment] = await list(siteKey, reactorA)
    expect(comment!.reactions).toEqual([{ emoji: '👍', count: 1, viewerReacted: true }])
  })
})

describe('page reactions', () => {
  test('the first reaction on a new page creates its thread, then counts and removes per viewer', async () => {
    const siteKey = `page-reactions-${crypto.randomUUID()}`
    siteKeys.push(siteKey)
    await db.insert(sites).values({ key: siteKey, name: 'Page reactions', pageReactionsEnabled: true })
    const reactorA = await createOwner('Page reactor A')
    const reactorB = await createOwner('Page reactor B')
    const pageUrl = 'https://example.test/brand-new-page'

    await expect(listPageReactions(siteKey, { pageUrl }, reactorA)).resolves.toEqual([])
    await expect(removePageReaction(siteKey, { pageUrl }, reactorA, '👍')).rejects.toMatchObject({
      code: 'PAGE_NOT_FOUND',
    })

    await expect(addPageReaction(siteKey, { pageUrl }, reactorA, '👍')).resolves.toEqual([
      { emoji: '👍', count: 1, viewerReacted: true },
    ])
    await expect(listPageReactions(siteKey, { pageUrl }, reactorB)).resolves.toEqual([
      { emoji: '👍', count: 1, viewerReacted: false },
    ])
    await expect(removePageReaction(siteKey, { pageUrl }, reactorA, '👍')).resolves.toEqual([])
  })

  test('a page keyed by slug is reached the same way from its key', async () => {
    const siteKey = `page-key-${crypto.randomUUID()}`
    siteKeys.push(siteKey)
    await db.insert(sites).values({ key: siteKey, name: 'Keyed reactions', pageReactionsEnabled: true })
    const reactor = await createOwner('Keyed reactor')
    const pageUrl = 'https://example.test/posts/keyed'

    await addPageReaction(siteKey, { pageUrl, pageKey: 'keyed-post' }, reactor, '🎉')
    await expect(listPageReactions(siteKey, { pageUrl, pageKey: 'keyed-post' }, reactor)).resolves.toEqual([
      { emoji: '🎉', count: 1, viewerReacted: true },
    ])
  })

  test('the page switch is separate from the comment switch, and a locked page refuses page reactions', async () => {
    const siteKey = `page-switch-${crypto.randomUUID()}`
    siteKeys.push(siteKey)
    await db.insert(sites).values({ key: siteKey, name: 'Switch test', commentReactionsEnabled: true })
    const reactor = await createOwner('Switch reactor')
    const pageUrl = 'https://example.test/switch'

    await expect(addPageReaction(siteKey, { pageUrl }, reactor, '👍')).rejects.toMatchObject({
      code: 'FEATURE_DISABLED',
    })

    await db
      .update(sites)
      .set({ pageReactionsEnabled: true, commentReactionsEnabled: false })
      .where(eq(sites.key, siteKey))
    await addPageReaction(siteKey, { pageUrl }, reactor, '👍')
    await db.update(pages).set({ isLocked: true }).where(eq(pages.canonicalUrl, pageUrl))
    await expect(addPageReaction(siteKey, { pageUrl }, reactor, '👍')).rejects.toMatchObject({
      code: 'PAGE_LOCKED',
    })
  })

  test('deleting a page removes its page reactions', async () => {
    const { pageId, reactorA } = await seed({ pageReactionsEnabled: true })
    await db.insert(pageReactions).values({ pageId, userId: reactorA, emoji: '👀' })
    await db.delete(pages).where(eq(pages.id, pageId))
    expect(await db.select().from(pageReactions).where(eq(pageReactions.pageId, pageId))).toHaveLength(0)
    // The viewer account itself is untouched by removing the page.
    expect(await db.select().from(user).where(eq(user.id, reactorA))).toHaveLength(1)
  })
})
