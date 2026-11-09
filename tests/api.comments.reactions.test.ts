import { afterAll, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { comments, pages, siteOrigins, sites } from '@/server/db/schema'
import { cleanupTestData, createSignedInUser, handlerOf, siteKeys } from './helpers/integration'

const db = getBusinessDb()
const origin = 'https://reactions-api.example.test'
const pageUrl = 'https://example.test/reactions-api'

afterAll(cleanupTestData)

function configureAuth() {
  Bun.env.BETTER_AUTH_URL = 'http://localhost:3000'
  Bun.env.BETTER_AUTH_SECRET = 'test-only-secret-at-least-32-characters'
  Bun.env.GOOGLE_CLIENT_ID = 'test-client-id'
  Bun.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
}

test('signed-in visitors react to a comment and to the page, and see their own counts back', async () => {
  configureAuth()

  const commentRoute = (await import('@/routes/api.comments.reactions')).Route
  const pageRoute = (await import('@/routes/api.comments.page-reactions')).Route
  const putComment = handlerOf(commentRoute, 'PUT')
  const deleteComment = handlerOf(commentRoute, 'DELETE')
  const putPage = handlerOf(pageRoute, 'PUT')
  const getPage = handlerOf(pageRoute, 'GET')

  const siteKey = `reactions-api-${crypto.randomUUID()}`
  siteKeys.push(siteKey)
  await db
    .insert(sites)
    .values({ key: siteKey, name: 'Reactions API', commentReactionsEnabled: true, pageReactionsEnabled: true })
  const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey))
  await db.insert(siteOrigins).values({ siteId: site!.id, origin })
  const [page] = await db.insert(pages).values({ siteId: site!.id, canonicalUrl: pageUrl }).returning({ id: pages.id })
  const [comment] = await db
    .insert(comments)
    .values({ siteId: site!.id, pageId: page!.id, authorName: 'Guest', bodyMarkdown: 'React to this' })
    .returning({ id: comments.id })

  const { cookie } = await createSignedInUser()
  const base = 'http://localhost:3000/api/comments'
  const signedIn = { origin, cookie, 'content-type': 'application/json' }

  const react = await putComment(
    new Request(`${base}/reactions`, {
      method: 'PUT',
      headers: signedIn,
      body: JSON.stringify({ site: siteKey, commentId: comment!.id, emoji: '👍' }),
    }),
  )
  expect(react.status).toBe(200)
  await expect(react.json()).resolves.toEqual({
    data: { reactions: [{ emoji: '👍', count: 1, viewerReacted: true }] },
  })

  // An emoji outside the allowlist is a validation error, not a stored row.
  const refused = await putComment(
    new Request(`${base}/reactions`, {
      method: 'PUT',
      headers: signedIn,
      body: JSON.stringify({ site: siteKey, commentId: comment!.id, emoji: '🙂' }),
    }),
  )
  expect(refused.status).toBe(400)
  await expect(refused.json()).resolves.toMatchObject({ error: { code: 'VALIDATION_ERROR' } })

  const removed = await deleteComment(
    new Request(
      `${base}/reactions?site=${encodeURIComponent(siteKey)}&commentId=${comment!.id}&emoji=${encodeURIComponent('👍')}`,
      { method: 'DELETE', headers: signedIn },
    ),
  )
  expect(removed.status).toBe(200)
  await expect(removed.json()).resolves.toEqual({ data: { reactions: [] } })

  // The page already has its thread from the comment above, and a guest sees counts without a viewer state.
  const pageReact = await putPage(
    new Request(`${base}/page-reactions`, {
      method: 'PUT',
      headers: signedIn,
      body: JSON.stringify({ site: siteKey, url: pageUrl, emoji: '🎉' }),
    }),
  )
  expect(pageReact.status).toBe(200)
  await expect(pageReact.json()).resolves.toEqual({
    data: { reactions: [{ emoji: '🎉', count: 1, viewerReacted: true }] },
  })

  const guestRead = await getPage(
    new Request(`${base}/page-reactions?site=${encodeURIComponent(siteKey)}&url=${encodeURIComponent(pageUrl)}`, {
      headers: { origin },
    }),
  )
  expect(guestRead.status).toBe(200)
  await expect(guestRead.json()).resolves.toEqual({
    data: { reactions: [{ emoji: '🎉', count: 1, viewerReacted: false }] },
  })

  const guestWrite = await putComment(
    new Request(`${base}/reactions`, {
      method: 'PUT',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ site: siteKey, commentId: comment!.id, emoji: '👍' }),
    }),
  )
  expect(guestWrite.status).toBe(401)
  await expect(guestWrite.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } })
})

test('a reaction that starts a page thread spends the thread budget, so the sixth new page is refused', async () => {
  configureAuth()
  const putPage = handlerOf((await import('@/routes/api.comments.page-reactions')).Route, 'PUT')

  const siteKey = `reactions-budget-${crypto.randomUUID()}`
  siteKeys.push(siteKey)
  await db.insert(sites).values({ key: siteKey, name: 'Reactions budget', pageReactionsEnabled: true })
  const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey))
  await db.insert(siteOrigins).values({ siteId: site!.id, origin })

  const { cookie } = await createSignedInUser()
  const react = (url: string) =>
    putPage(
      new Request('http://localhost:3000/api/comments/page-reactions', {
        method: 'PUT',
        headers: { origin, cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ site: siteKey, url, emoji: '👍' }),
      }),
    )

  // Five new pages start their threads, the most the thread budget allows in ten minutes.
  for (let index = 0; index < 5; index++) expect((await react(`${pageUrl}-new-${index}`)).status).toBe(200)

  const sixth = await react(`${pageUrl}-new-5`)
  expect(sixth.status).toBe(429)
  await expect(sixth.json()).resolves.toMatchObject({ error: { code: 'RATE_LIMITED' } })
  expect(await db.select().from(pages).where(eq(pages.siteId, site!.id))).toHaveLength(5)

  // A reaction on a page whose thread already exists spends the reaction budget, which is still open.
  expect((await react(`${pageUrl}-new-0`)).status).toBe(200)
})
