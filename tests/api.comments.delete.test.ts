import { afterAll, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { comments, siteOrigins, sites } from '@/server/db/schema'
import { cleanupTestData, createTestComment, handlerOfParams, handlerOf, siteKeys } from './helpers/integration'

const db = getBusinessDb()
const origin = 'https://comments-client.example.test'

afterAll(cleanupTestData)

test('DELETE /api/comments/:id lets a guest delete with the edit key header, and nothing else', async () => {
  Bun.env.BETTER_AUTH_URL = 'http://localhost:3000'
  Bun.env.BETTER_AUTH_SECRET = 'test-only-secret-at-least-32-characters'
  Bun.env.GOOGLE_CLIENT_ID = 'test-client-id'
  Bun.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

  const siteKey = `delete-api-${crypto.randomUUID()}`
  siteKeys.push(siteKey)
  await db.insert(sites).values({ key: siteKey, name: 'Delete API test' })
  const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey))
  await db.insert(siteOrigins).values({ siteId: site!.id, origin })
  const guest = await createTestComment({
    siteKey,
    pageUrl: 'https://example.test/delete-api',
    userId: null,
    authorName: 'Guest',
    bodyMarkdown: 'Retract me',
  })

  // Static imports would load the better-auth graph before the env vars above.
  const route = (await import('@/routes/api.comments.$commentId')).Route
  const remove = handlerOfParams(route, 'DELETE')
  const preflight = handlerOf(route, 'OPTIONS')
  const url = `http://localhost:3000/api/comments/${guest.id}?site=${siteKey}`
  // The rate limit needs a client identity; loopback is a trusted ingress for the test.
  const client = { origin, 'x-real-ip': '127.0.0.1' }

  const preflightResponse = await preflight(new Request(url, { method: 'OPTIONS', headers: { origin } }))
  expect(preflightResponse.headers.get('access-control-allow-headers')).toContain('x-lc-edit-key')

  const withoutCredentials = await remove(new Request(url, { method: 'DELETE', headers: client }), {
    commentId: guest.id,
  })
  expect(withoutCredentials.status).toBe(401)
  await expect(withoutCredentials.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } })

  const tooLong = await remove(
    new Request(url, { method: 'DELETE', headers: { ...client, 'x-lc-edit-key': 'k'.repeat(129) } }),
    { commentId: guest.id },
  )
  expect(tooLong.status).toBe(400)

  const wrongKey = await remove(
    new Request(url, { method: 'DELETE', headers: { ...client, 'x-lc-edit-key': 'not-the-key' } }),
    { commentId: guest.id },
  )
  expect(wrongKey.status).toBe(404)

  const deleted = await remove(
    new Request(url, { method: 'DELETE', headers: { ...client, 'x-lc-edit-key': guest.editKey! } }),
    { commentId: guest.id },
  )
  expect(deleted.status).toBe(200)
  expect(deleted.headers.get('access-control-allow-origin')).toBe(origin)
  await expect(deleted.json()).resolves.toMatchObject({ data: { comment: { id: guest.id, status: 'deleted' } } })

  const again = await remove(
    new Request(url, { method: 'DELETE', headers: { ...client, 'x-lc-edit-key': guest.editKey! } }),
    { commentId: guest.id },
  )
  expect(again.status).toBe(404)
})

test('DELETE /api/comments/:id refuses to retract a hidden comment, so a moderator restore cannot republish it', async () => {
  Bun.env.BETTER_AUTH_URL = 'http://localhost:3000'
  Bun.env.BETTER_AUTH_SECRET = 'test-only-secret-at-least-32-characters'
  Bun.env.GOOGLE_CLIENT_ID = 'test-client-id'
  Bun.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

  const siteKey = `delete-hidden-${crypto.randomUUID()}`
  siteKeys.push(siteKey)
  await db.insert(sites).values({ key: siteKey, name: 'Delete hidden test' })
  const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey))
  await db.insert(siteOrigins).values({ siteId: site!.id, origin })
  const guest = await createTestComment({
    siteKey,
    pageUrl: 'https://example.test/delete-hidden',
    userId: null,
    authorName: 'Guest',
    bodyMarkdown: 'Held for review',
  })
  await db.update(comments).set({ status: 'hidden' }).where(eq(comments.id, guest.id))

  const route = (await import('@/routes/api.comments.$commentId')).Route
  const remove = handlerOfParams(route, 'DELETE')
  const url = `http://localhost:3000/api/comments/${guest.id}?site=${siteKey}`
  const response = await remove(
    new Request(url, {
      method: 'DELETE',
      headers: { origin, 'x-real-ip': '127.0.0.1', 'x-lc-edit-key': guest.editKey! },
    }),
    { commentId: guest.id },
  )
  expect(response.status).toBe(404)

  const [row] = await db.select({ status: comments.status }).from(comments).where(eq(comments.id, guest.id))
  expect(row?.status).toBe('hidden')
})
