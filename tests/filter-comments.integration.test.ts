import { afterAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { sites } from '@/server/db/schema'
import { createComment } from '@/server/modules/comments/application/create-comment'
import {
  editOwnComment,
  listModerationComments,
  listPageComments,
  persistComment,
  prepareCommentCreation,
} from '@/server/modules/comments/infrastructure/comment-repository'
import { EMPTY_SCREENING } from '@/server/plugins/comment-plugins'
import { cleanupTestData, createTestComment, siteKeys } from './helpers/integration'

const db = getBusinessDb()

afterAll(cleanupTestData)

async function setupSite(): Promise<string> {
  const siteKey = `filter-${crypto.randomUUID()}`
  siteKeys.push(siteKey)
  await db.insert(sites).values({ key: siteKey, name: 'Filter site' })
  return siteKey
}

const hideScreening = {
  decision: 'hide' as const,
  reasons: ['Blocked term matched'],
  triggeredCategories: ['lexical'],
}

describe('filter persistence wiring', () => {
  test('screened-hide creates persist as hidden, invisible publicly, visible in review', async () => {
    const siteKey = await setupSite()
    const pageUrl = 'https://example.test/filter-hidden'
    const comment = await createComment(
      { siteKey, pageUrl, userId: null, authorName: 'Guest', bodyMarkdown: 'spammy bulk promo' },
      {
        prepare: prepareCommentCreation,
        validate: async () => {},
        screen: async () => hideScreening,
        persist: persistComment,
      },
    )
    expect(comment.status).toBe('hidden')

    expect(await listPageComments(siteKey, pageUrl, { limit: 20, offset: 0 })).toHaveLength(0)

    const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey))
    const review = await listModerationComments(site!.id, { status: 'hidden', limit: 20, offset: 0 })
    expect(review.total).toBe(1)
    expect(review.comments[0]!.id).toBe(comment.id)
  })

  test('unscreened creates stay visible (all-off behaviour preserved)', async () => {
    const siteKey = await setupSite()
    const pageUrl = 'https://example.test/filter-visible'
    const comment = await createTestComment({
      siteKey,
      pageUrl,
      userId: null,
      authorName: 'Guest',
      bodyMarkdown: 'hello',
    })
    expect(comment.status).toBe('visible')
    expect(await listPageComments(siteKey, pageUrl, { limit: 20, offset: 0 })).toHaveLength(1)
  })

  test('edit with a hide verdict flips visible to hidden', async () => {
    const siteKey = await setupSite()
    const pageUrl = 'https://example.test/filter-edit'
    const comment = await createTestComment({
      siteKey,
      pageUrl,
      userId: null,
      authorName: 'Guest',
      bodyMarkdown: 'clean to start',
    })
    expect(typeof comment.editKey).toBe('string')

    const edited = await editOwnComment(
      { siteKey, commentId: comment.id, userId: null, editKey: comment.editKey!, bodyMarkdown: 'now with spam' },
      hideScreening,
    )
    expect(edited.status).toBe('hidden')
    expect(await listPageComments(siteKey, pageUrl, { limit: 20, offset: 0 })).toHaveLength(0)
  })

  test('edit without screening keeps the row visible', async () => {
    const siteKey = await setupSite()
    const pageUrl = 'https://example.test/filter-edit-clean'
    const comment = await createTestComment({
      siteKey,
      pageUrl,
      userId: null,
      authorName: 'Guest',
      bodyMarkdown: 'clean to start',
    })
    const edited = await editOwnComment(
      { siteKey, commentId: comment.id, userId: null, editKey: comment.editKey!, bodyMarkdown: 'still clean' },
      EMPTY_SCREENING,
    )
    expect(edited.status).toBe('visible')
  })
})
