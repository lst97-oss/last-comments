import { afterAll, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { siteOrigins, sites } from '@/server/db/schema'
import { cleanupTestData, handlerOf, siteKeys } from './helpers/integration'

const db = getBusinessDb()
const origin = 'https://reactions-policy.example.test'
const pageUrl = 'https://example.test/policy-page'

afterAll(cleanupTestData)

async function siteWith(values: {
  commentReactionsEnabled?: boolean
  pageReactionsEnabled?: boolean
  gatewayOnly?: boolean
}) {
  const siteKey = `reactions-policy-${crypto.randomUUID()}`
  siteKeys.push(siteKey)
  await db.insert(sites).values({ key: siteKey, name: 'Reaction policy test', ...values })
  const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey))
  await db.insert(siteOrigins).values({ siteId: site!.id, origin })
  return siteKey
}

test('each reaction switch is checked on its own route, before any sign-in prompt, and gateway-only sites refuse writes', async () => {
  Bun.env.BETTER_AUTH_URL = 'http://localhost:3000'
  Bun.env.BETTER_AUTH_SECRET = 'test-only-secret-at-least-32-characters'
  Bun.env.GOOGLE_CLIENT_ID = 'test-client-id'
  Bun.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

  const commentRoute = (await import('@/routes/api.comments.reactions')).Route
  const pageRoute = (await import('@/routes/api.comments.page-reactions')).Route
  const putComment = handlerOf(commentRoute, 'PUT')
  const putPage = handlerOf(pageRoute, 'PUT')
  const getPage = handlerOf(pageRoute, 'GET')
  const commentId = crypto.randomUUID()
  const url = 'http://localhost:3000/api/comments/reactions'
  const pageEndpoint = 'http://localhost:3000/api/comments/page-reactions'

  const commentPut = (site: string) =>
    putComment(
      new Request(url, {
        method: 'PUT',
        headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify({ site, commentId, emoji: '👍' }),
      }),
    )
  const pagePut = (site: string) =>
    putPage(
      new Request(pageEndpoint, {
        method: 'PUT',
        headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify({ site, url: pageUrl, emoji: '👍' }),
      }),
    )

  const none = await siteWith({})
  const noneComment = await commentPut(none)
  expect(noneComment.status).toBe(403)
  await expect(noneComment.json()).resolves.toMatchObject({ error: { code: 'FEATURE_DISABLED' } })
  const nonePage = await pagePut(none)
  expect(nonePage.status).toBe(403)
  await expect(nonePage.json()).resolves.toMatchObject({ error: { code: 'FEATURE_DISABLED' } })

  // Comment reactions on, page bar off: the comment route moves on to the session check, the page route refuses.
  const commentOnly = await siteWith({ commentReactionsEnabled: true })
  const commentOnlyComment = await commentPut(commentOnly)
  expect(commentOnlyComment.status).toBe(401)
  await expect(commentOnlyComment.json()).resolves.toMatchObject({ error: { code: 'UNAUTHENTICATED' } })
  const commentOnlyPage = await pagePut(commentOnly)
  expect(commentOnlyPage.status).toBe(403)
  await expect(commentOnlyPage.json()).resolves.toMatchObject({ error: { code: 'FEATURE_DISABLED' } })

  // The reverse: page bar on, comment reactions off.
  const pageOnly = await siteWith({ pageReactionsEnabled: true })
  const pageOnlyComment = await commentPut(pageOnly)
  expect(pageOnlyComment.status).toBe(403)
  await expect(pageOnlyComment.json()).resolves.toMatchObject({ error: { code: 'FEATURE_DISABLED' } })
  const pageOnlyPage = await pagePut(pageOnly)
  expect(pageOnlyPage.status).toBe(401)

  // A gateway-only site takes no browser writes, even with both switches on.
  const gateway = await siteWith({ commentReactionsEnabled: true, pageReactionsEnabled: true, gatewayOnly: true })
  const gatewayComment = await commentPut(gateway)
  expect(gatewayComment.status).toBe(403)
  await expect(gatewayComment.json()).resolves.toMatchObject({ error: { code: 'FORBIDDEN' } })

  // Reading the page bar is refused when its switch is off, so the counts stay behind the same switch.
  const readOff = await getPage(
    new Request(`${pageEndpoint}?site=${encodeURIComponent(none)}&url=${encodeURIComponent(pageUrl)}`, {
      headers: { origin },
    }),
  )
  expect(readOff.status).toBe(403)
  await expect(readOff.json()).resolves.toMatchObject({ error: { code: 'FEATURE_DISABLED' } })
})
