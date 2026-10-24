import { afterAll, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { comments, pages, siteOrigins, sites, user, votes } from '@/server/db/schema'
import { handlerOf } from './helpers/integration'

const db = getBusinessDb()
const siteKey = `vote-api-${crypto.randomUUID()}`
const voterId = crypto.randomUUID()
const origin = 'https://comments-client.example.test'

afterAll(async () => {
  await db.delete(sites).where(eq(sites.key, siteKey))
  await db.delete(user).where(eq(user.id, voterId))
})

test('vote writes require an allowed origin and signed-in Better Auth session', async () => {
  Bun.env.BETTER_AUTH_URL = 'http://localhost:3000'
  Bun.env.BETTER_AUTH_SECRET = 'test-only-secret-at-least-32-characters'
  Bun.env.GOOGLE_CLIENT_ID = 'test-client-id'
  Bun.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

  await db.insert(sites).values({ key: siteKey, name: 'Vote API test' })
  const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey))
  await db.insert(siteOrigins).values({ siteId: site!.id, origin })
  await db.insert(user).values({ id: voterId, name: 'API voter', email: `${voterId}@test.invalid` })
  const [page] = await db
    .insert(pages)
    .values({ siteId: site!.id, canonicalUrl: 'https://example.test/api-votes' })
    .returning({ id: pages.id })
  const [comment] = await db
    .insert(comments)
    .values({ pageId: page!.id, authorName: 'Guest', bodyMarkdown: 'Public vote score' })
    .returning({ id: comments.id })
  await db.insert(votes).values({ commentId: comment!.id, userId: voterId, value: 1 })

  // Static imports would load the better-auth graph before the env vars above
  // are set; this test exercises that lazy-init boundary.
  const voteRoute = (await import('@/routes/api.comments.vote')).Route
  const putVote = handlerOf(voteRoute, 'PUT')
  const deleteVote = handlerOf(voteRoute, 'DELETE')
  const preflightVote = handlerOf(voteRoute, 'OPTIONS')
  const commentsRoute = (await import('@/routes/api.comments')).Route
  const listComments = handlerOf(commentsRoute, 'GET')
  const preflightComments = handlerOf(commentsRoute, 'OPTIONS')

  const commentsResponse = await listComments(
    new Request(
      `http://localhost:3000/api/comments?site=${siteKey}&url=${encodeURIComponent('https://example.test/api-votes')}`,
      { headers: { origin } },
    ),
  )
  expect(commentsResponse.status).toBe(200)
  await expect(commentsResponse.json()).resolves.toMatchObject({
    data: { comments: [{ id: comment!.id, score: 1, viewerVote: null }] },
  })

  const response = await putVote(
    new Request('http://localhost:3000/api/comments/vote', {
      method: 'PUT',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ site: siteKey, commentId: crypto.randomUUID(), value: 1 }),
    }),
  )

  expect(response.status).toBe(401)
  expect(response.headers.get('access-control-allow-origin')).toBe(origin)
  await expect(response.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } })

  const clearVote = await deleteVote(
    new Request(`http://localhost:3000/api/comments/vote?site=${siteKey}&commentId=${crypto.randomUUID()}`, {
      method: 'DELETE',
      headers: { origin },
    }),
  )
  expect(clearVote.status).toBe(401)

  const invalidVote = await putVote(
    new Request('http://localhost:3000/api/comments/vote', {
      method: 'PUT',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ site: siteKey, commentId: crypto.randomUUID(), value: 0 }),
    }),
  )
  expect(invalidVote.status).toBe(400)

  const untrustedOrigin = await putVote(
    new Request('http://localhost:3000/api/comments/vote', {
      method: 'PUT',
      headers: { origin: 'https://untrusted.example.test', 'content-type': 'application/json' },
      body: JSON.stringify({ site: siteKey, commentId: crypto.randomUUID(), value: 1 }),
    }),
  )
  expect(untrustedOrigin.status).toBe(403)

  const missingOrigin = await putVote(
    new Request('http://localhost:3000/api/comments/vote', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ site: siteKey, commentId: crypto.randomUUID(), value: 1 }),
    }),
  )
  expect(missingOrigin.status).toBe(403)

  const preflight = await preflightVote(
    new Request(`http://localhost:3000/api/comments/vote?site=${siteKey}`, {
      method: 'OPTIONS',
      headers: { origin },
    }),
  )
  expect(preflight.status).toBe(204)
  expect(preflight.headers.get('access-control-allow-methods')).toBe('PUT, DELETE, OPTIONS')

  // POST/PUT/PATCH preflights carry the site in the body, which the browser
  // does not send on OPTIONS. The origin alone must be enough to answer.
  const postPreflight = await preflightComments(
    new Request('http://localhost:3000/api/comments', {
      method: 'OPTIONS',
      headers: {
        origin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    }),
  )
  expect(postPreflight.status).toBe(204)
  expect(postPreflight.headers.get('access-control-allow-origin')).toBe(origin)
  expect(postPreflight.headers.get('access-control-allow-credentials')).toBe('true')

  const untrustedPostPreflight = await preflightComments(
    new Request('http://localhost:3000/api/comments', {
      method: 'OPTIONS',
      headers: { origin: 'https://untrusted.example.test' },
    }),
  )
  expect(untrustedPostPreflight.status).toBe(403)

  // A DELETE vote preflight also carries commentId; it must not be rejected by
  // a strict `{ site }` query schema before CORS is applied.
  const votePreflightWithCommentId = await preflightVote(
    new Request(`http://localhost:3000/api/comments/vote?site=${siteKey}&commentId=${crypto.randomUUID()}`, {
      method: 'OPTIONS',
      headers: { origin },
    }),
  )
  expect(votePreflightWithCommentId.status).toBe(204)
})
