import { afterAll, describe, expect, test } from 'bun:test'

import { getBusinessDb } from '@/server/db/business-sql'
import { sites, user } from '@/server/db/schema'
import {
  getSiteId,
  listModerationPages,
  listPageComments,
  setPageLocked,
} from '@/server/modules/comments/infrastructure/comment-repository'
import { normalizePageKey } from '@/server/modules/comments/domain/comment'
import { cleanupTestData, createTestComment, siteKeys, userIds } from './helpers/integration'

const db = getBusinessDb()

afterAll(cleanupTestData)

describe('page key slugs', () => {
  test('creates a thread by slug and reads it back without the url', async () => {
    const siteKey = `slug-${crypto.randomUUID()}`
    siteKeys.push(siteKey)
    await db.insert(sites).values({ key: siteKey, name: 'Slug site' })

    const comment = await createTestComment({
      siteKey,
      pageUrl: 'https://example.test/post/this-is-test',
      pageKey: 'this-is-test',
      userId: null,
      authorName: 'Guest',
      bodyMarkdown: 'Slug comment',
    })
    expect(comment.pageId).toBeString()

    const bySlug = await listPageComments(siteKey, 'https://example.test/ignored', {
      limit: 20,
      offset: 0,
      pageKey: 'this-is-test',
    })
    expect(bySlug).toHaveLength(1)
    const byUrl = await listPageComments(siteKey, 'https://example.test/post/this-is-test', {
      limit: 20,
      offset: 0,
    })
    expect(byUrl).toHaveLength(1)
    expect(byUrl[0]!.id).toBe(bySlug[0]!.id)
  })

  test('same slug on a new url keeps the thread and refreshes the canonical url', async () => {
    const siteKey = `slug-move-${crypto.randomUUID()}`
    siteKeys.push(siteKey)
    await db.insert(sites).values({ key: siteKey, name: 'Slug move site' })

    await createTestComment({
      siteKey,
      pageUrl: 'https://example.test/old-path',
      pageKey: 'moved-post',
      userId: null,
      authorName: 'Guest',
      bodyMarkdown: 'First',
    })
    await createTestComment({
      siteKey,
      pageUrl: 'https://example.test/new-path',
      pageKey: 'moved-post',
      title: 'Moved',
      userId: null,
      authorName: 'Guest',
      bodyMarkdown: 'Second',
    })

    const siteId = await getSiteId(siteKey)
    const summaries = await listModerationPages(siteId)
    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({
      pageKey: 'moved-post',
      canonicalUrl: 'https://example.test/new-path',
      total: 2,
    })
  })

  test('same slug on another site is an independent thread', async () => {
    const siteA = `slug-a-${crypto.randomUUID()}`
    const siteB = `slug-b-${crypto.randomUUID()}`
    siteKeys.push(siteA, siteB)
    await db.insert(sites).values([
      { key: siteA, name: 'Site A' },
      { key: siteB, name: 'Site B' },
    ])

    await createTestComment({
      siteKey: siteA,
      pageUrl: 'https://a.test/post',
      pageKey: 'shared-slug',
      userId: null,
      authorName: 'Guest',
      bodyMarkdown: 'A comment',
    })
    expect(
      await listPageComments(siteB, 'https://b.test/post', { limit: 20, offset: 0, pageKey: 'shared-slug' }),
    ).toHaveLength(0)
  })

  test('invalid slugs are rejected', async () => {
    const siteKey = `slug-bad-${crypto.randomUUID()}`
    siteKeys.push(siteKey)
    await db.insert(sites).values({ key: siteKey, name: 'Bad slug site' })

    await expect(
      createTestComment({
        siteKey,
        pageUrl: 'https://example.test/post',
        pageKey: 'Bad Slug!',
        userId: null,
        authorName: 'Guest',
        bodyMarkdown: 'Nope',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PAGE_KEY', status: 400 })
    expect(() => normalizePageKey(' THIS_IS_TEST ')).toThrow()
  })

  test('slug pointing at a different url thread is a 409', async () => {
    const siteKey = `slug-clash-${crypto.randomUUID()}`
    siteKeys.push(siteKey)
    await db.insert(sites).values({ key: siteKey, name: 'Slug clash site' })

    await createTestComment({
      siteKey,
      pageUrl: 'https://example.test/first',
      pageKey: 'first-post',
      userId: null,
      authorName: 'Guest',
      bodyMarkdown: 'First',
    })
    await createTestComment({
      siteKey,
      pageUrl: 'https://example.test/second',
      userId: null,
      authorName: 'Guest',
      bodyMarkdown: 'Second',
    })
    await expect(
      createTestComment({
        siteKey,
        pageUrl: 'https://example.test/second',
        pageKey: 'first-post',
        userId: null,
        authorName: 'Guest',
        bodyMarkdown: 'Clash',
      }),
    ).rejects.toMatchObject({ code: 'PAGE_KEY_MISMATCH', status: 409 })
  })

  test('page lock by id, unknown id is 404', async () => {
    const siteKey = `slug-lock-${crypto.randomUUID()}`
    const actorId = crypto.randomUUID()
    siteKeys.push(siteKey)
    userIds.push(actorId)
    await db.insert(sites).values({ key: siteKey, name: 'Slug lock site' })
    await db.insert(user).values([{ id: actorId, name: 'Moderator', email: `${actorId}@test.invalid` }])

    const comment = await createTestComment({
      siteKey,
      pageUrl: 'https://example.test/lockable',
      pageKey: 'lockable',
      userId: null,
      authorName: 'Guest',
      bodyMarkdown: 'Lock me',
    })
    const siteId = await getSiteId(siteKey)
    const locked = await setPageLocked(siteId, actorId, comment.pageId, true)
    expect(locked).toMatchObject({ id: comment.pageId, isLocked: true })
    await expect(
      createTestComment({
        siteKey,
        pageUrl: 'https://example.test/lockable',
        pageKey: 'lockable',
        userId: null,
        authorName: 'Guest',
        bodyMarkdown: 'Blocked',
      }),
    ).rejects.toMatchObject({ code: 'PAGE_LOCKED', status: 409 })
    await expect(setPageLocked(siteId, actorId, crypto.randomUUID(), true)).rejects.toMatchObject({
      code: 'PAGE_NOT_FOUND',
      status: 404,
    })
  })
})
