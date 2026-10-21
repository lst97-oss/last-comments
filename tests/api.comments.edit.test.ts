import { afterAll, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { sites, siteOrigins } from '@/server/db/schema'
import { COMMENT_BODY_LIMIT } from '@/lib/comment-schema'
import { cleanupTestData, createTestComment, handlerOfParams, siteKeys } from './helpers/integration'

const db = getBusinessDb()
const siteKey = `edit-api-${crypto.randomUUID()}`
const origin = 'https://comments-client.example.test'

afterAll(cleanupTestData)

test('PATCH /api/comments/:id accepts a guest edit key and rejects missing or wrong credentials', async () => {
  Bun.env.BETTER_AUTH_URL = 'http://localhost:3000'
  Bun.env.BETTER_AUTH_SECRET = 'test-only-secret-at-least-32-characters'
  Bun.env.GOOGLE_CLIENT_ID = 'test-client-id'
  Bun.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

  siteKeys.push(siteKey)
  await db.insert(sites).values({ key: siteKey, name: 'Edit API test' })
  const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey))
  await db.insert(siteOrigins).values({ siteId: site!.id, origin })

  const created = await createTestComment({
    siteKey,
    pageUrl: 'https://example.test/edit-api',
    userId: null,
    authorName: 'Guest',
    bodyMarkdown: 'Before',
  })
  expect(created.editKey).toBeString()

  // Static imports would load the better-auth graph before the env vars above.
  const route = (await import('@/routes/api.comments.$commentId')).Route
  const patch = handlerOfParams(route, 'PATCH')
  const url = `http://localhost:3000/api/comments/${created.id}`

  const missingKey = await patch(
    new Request(url, {
      method: 'PATCH',
      headers: { origin, 'content-type': 'application/json', 'x-real-ip': '127.0.0.1' },
      body: JSON.stringify({ site: siteKey, bodyMarkdown: 'No credential' }),
    }),
    { commentId: created.id },
  )
  expect(missingKey.status).toBe(401)
  await expect(missingKey.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } })

  const wrongKey = await patch(
    new Request(url, {
      method: 'PATCH',
      headers: { origin, 'content-type': 'application/json', 'x-real-ip': '127.0.0.1' },
      body: JSON.stringify({ site: siteKey, bodyMarkdown: 'Wrong key', editKey: 'not-the-key' }),
    }),
    { commentId: created.id },
  )
  expect(wrongKey.status).toBe(404)
  await expect(wrongKey.json()).resolves.toMatchObject({ error: { code: 'COMMENT_NOT_FOUND' } })

  const edited = await patch(
    new Request(url, {
      method: 'PATCH',
      headers: { origin, 'content-type': 'application/json', 'x-real-ip': '127.0.0.1' },
      body: JSON.stringify({ site: siteKey, bodyMarkdown: 'After', editKey: created.editKey }),
    }),
    { commentId: created.id },
  )
  expect(edited.status).toBe(200)
  const payload = (await edited.json()) as { data: { comment: { bodyMarkdown: string; editKeyHash?: unknown } } }
  expect(payload.data.comment.bodyMarkdown).toBe('After')
  expect('editKeyHash' in payload.data.comment).toBe(false)
})

// The widget counts characters before trimming (`bodyLimit`), so the schema must
// cap the raw body: a body that only trims under the limit is still rejected.
test('PATCH /api/comments/:id caps the raw body before trimming', async () => {
  Bun.env.BETTER_AUTH_URL = 'http://localhost:3000'
  Bun.env.BETTER_AUTH_SECRET = 'test-only-secret-at-least-32-characters'
  Bun.env.GOOGLE_CLIENT_ID = 'test-client-id'
  Bun.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

  const limitSiteKey = `edit-limit-${crypto.randomUUID()}`
  siteKeys.push(limitSiteKey)
  await db.insert(sites).values({ key: limitSiteKey, name: 'Edit limit test' })
  const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, limitSiteKey))
  await db.insert(siteOrigins).values({ siteId: site!.id, origin })

  const created = await createTestComment({
    siteKey: limitSiteKey,
    pageUrl: 'https://example.test/edit-limit',
    userId: null,
    authorName: 'Guest',
    bodyMarkdown: 'Before',
  })

  const route = (await import('@/routes/api.comments.$commentId')).Route
  const patch = handlerOfParams(route, 'PATCH')
  const url = `http://localhost:3000/api/comments/${created.id}`
  const send = (bodyMarkdown: string) =>
    patch(
      new Request(url, {
        method: 'PATCH',
        headers: { origin, 'content-type': 'application/json', 'x-real-ip': '127.0.0.1' },
        body: JSON.stringify({ site: limitSiteKey, bodyMarkdown, editKey: created.editKey }),
      }),
      { commentId: created.id },
    )

  const atLimit = await send('x'.repeat(COMMENT_BODY_LIMIT))
  expect(atLimit.status).toBe(200)

  const overRaw = await send(`${'x'.repeat(COMMENT_BODY_LIMIT)}   `)
  expect(overRaw.status).toBe(400)
  await expect(overRaw.json()).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } })

  const blank = await send('   ')
  expect(blank.status).toBe(400)
  await expect(blank.json()).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } })
})
