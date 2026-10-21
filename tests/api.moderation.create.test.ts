import { afterAll, expect, test } from 'bun:test'
import { getBusinessDb } from '@/server/db/business-sql'
import { pages, siteMemberships, sites } from '@/server/db/schema'
import {
  cleanupTestData,
  createSignedInUser,
  handlerOf,
  type InstanceAdminLoan,
  jsonRequest,
  lendInstanceAdmin,
  returnInstanceAdmin,
  siteKeys,
} from './helpers/integration'

// Lazy: another test file's drainAll() closes the shared pool mid-run.
const db = () => getBusinessDb()
const siteKey = `moderation-create-${crypto.randomUUID()}`
let adminLoan: InstanceAdminLoan | undefined

afterAll(async () => {
  if (adminLoan) await returnInstanceAdmin(adminLoan)
  await cleanupTestData()
})

test('moderation comment-create posts as the moderator or anonymously', async () => {
  Bun.env.BETTER_AUTH_URL = 'http://localhost:3000'
  Bun.env.BETTER_AUTH_SECRET = 'test-only-secret-at-least-32-characters'
  Bun.env.GOOGLE_CLIENT_ID = 'test-client-id'
  Bun.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

  const { userId, cookie } = await createSignedInUser()
  adminLoan = await lendInstanceAdmin(userId)

  siteKeys.push(siteKey)
  const [site] = await db().insert(sites).values({ key: siteKey, name: 'Moderation create test' }).returning({
    id: sites.id,
  })
  await db().insert(siteMemberships).values({ siteId: site!.id, userId, role: 'admin' })
  const [page] = await db()
    .insert(pages)
    .values({ siteId: site!.id, canonicalUrl: 'https://example.test/moderation-create' })
    .returning({ id: pages.id })

  // Static imports would load the better-auth graph before the env vars above.
  const create = handlerOf((await import('@/routes/api.moderation')).Route, 'POST')
  const headers = { origin: 'http://localhost:3000', cookie }
  const post = (body: Record<string, unknown>) =>
    create(jsonRequest('http://localhost:3000/api/moderation', 'POST', { site: siteKey, ...body }, headers))

  const anonymous = await post({
    target: 'comment-create',
    pageId: page!.id,
    bodyMarkdown: 'Posted anonymously from the dashboard',
    anonymous: true,
    authorName: 'Dash guest',
  })
  expect(anonymous.status).toBe(200)
  const anonymousPayload = (await anonymous.json()) as {
    data: { comment: { userId: string | null; authorName: string; editKey?: string } }
  }
  expect(anonymousPayload.data.comment.userId).toBeNull()
  expect(anonymousPayload.data.comment.authorName).toBe('Dash guest')
  expect(anonymousPayload.data.comment.editKey).toBeString()

  const nameless = await post({
    target: 'comment-create',
    pageId: page!.id,
    bodyMarkdown: 'Anonymous without a name',
    anonymous: true,
  })
  expect(nameless.status).toBe(200)
  await expect(nameless.json()).resolves.toMatchObject({
    data: { comment: { userId: null, authorName: 'Anonymous' } },
  })

  const asAccount = await post({
    target: 'comment-create',
    pageId: page!.id,
    bodyMarkdown: 'Posted as the moderator',
  })
  expect(asAccount.status).toBe(200)
  await expect(asAccount.json()).resolves.toMatchObject({
    data: { comment: { userId, authorName: 'Session user' } },
  })

  await returnInstanceAdmin(adminLoan)
  adminLoan = undefined
})
