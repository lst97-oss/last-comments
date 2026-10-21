import { afterAll, expect, test } from 'bun:test'

import { getBusinessDb } from '@/server/db/business-sql'
import { comments, moderationEvents, pages, siteMemberships, sites, userBlocks, votes } from '@/server/db/schema'
import {
  cleanupTestData,
  createOwner,
  createSignedInUser,
  handlerOf,
  type InstanceAdminLoan,
  lendInstanceAdmin,
  returnInstanceAdmin,
  siteKeys,
} from './helpers/integration'

// Lazy: another test file's drainAll() closes the shared pool mid-run.
const db = () => getBusinessDb()
const siteKey = `admin-stats-${crypto.randomUUID()}`
const otherSiteKey = `admin-stats-other-${crypto.randomUUID()}`
let adminLoan: InstanceAdminLoan | undefined

const DAY = 24 * 60 * 60 * 1000
const now = new Date()
const yesterday = new Date(now.getTime() - DAY)
const twoDaysAgo = new Date(now.getTime() - 2 * DAY)

afterAll(async () => {
  if (adminLoan) await returnInstanceAdmin(adminLoan)
  await cleanupTestData()
})

test('dashboard stats aggregate totals, a zero-filled daily series and moderation activity', async () => {
  Bun.env.BETTER_AUTH_URL = 'http://localhost:3000'
  Bun.env.BETTER_AUTH_SECRET = 'test-only-secret-at-least-32-characters'
  Bun.env.GOOGLE_CLIENT_ID = 'test-client-id'
  Bun.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

  const { userId, cookie } = await createSignedInUser()
  adminLoan = await lendInstanceAdmin(userId)

  siteKeys.push(siteKey, otherSiteKey)
  const [site] = await db().insert(sites).values({ key: siteKey, name: 'Stats site' }).returning({ id: sites.id })
  await db().insert(sites).values({ key: otherSiteKey, name: 'Other stats site' })
  await db().insert(siteMemberships).values({ siteId: site!.id, userId, role: 'admin' })

  const [page] = await db()
    .insert(pages)
    .values({
      siteId: site!.id,
      canonicalUrl: 'https://example.test/stats',
      title: 'Stats thread',
    })
    .returning({ id: pages.id })
  const [quietPage] = await db()
    .insert(pages)
    .values({ siteId: site!.id, canonicalUrl: 'https://example.test/quiet' })
    .returning({ id: pages.id })

  const inserted = await db()
    .insert(comments)
    .values([
      {
        pageId: page!.id,
        authorName: 'Visible today',
        bodyMarkdown: 'One',
        status: 'visible',
        createdAt: now,
      },
      {
        pageId: page!.id,
        authorName: 'Visible yesterday',
        bodyMarkdown: 'Two',
        status: 'visible',
        createdAt: yesterday,
      },
      {
        pageId: page!.id,
        authorName: 'Hidden',
        bodyMarkdown: 'Three',
        status: 'hidden',
        createdAt: yesterday,
      },
      {
        pageId: page!.id,
        authorName: 'Deleted',
        bodyMarkdown: 'Four',
        status: 'deleted',
        createdAt: twoDaysAgo,
      },
      {
        pageId: quietPage!.id,
        authorName: 'Quiet thread',
        bodyMarkdown: 'Five',
        status: 'visible',
        createdAt: yesterday,
      },
    ])
    .returning({ id: comments.id })

  await db()
    .insert(votes)
    .values([
      { commentId: inserted[0]!.id, userId, value: 1, createdAt: now },
      { commentId: inserted[1]!.id, userId, value: -1, createdAt: yesterday },
    ])

  // One live block and one expired block: only the live one counts.
  const blockedUser = await createOwner('Blocked user')
  const expiredUser = await createOwner('Expired block user')
  await db()
    .insert(userBlocks)
    .values([
      {
        siteId: site!.id,
        userId: blockedUser,
        createdByUserId: userId,
        reason: 'spam',
      },
      {
        siteId: site!.id,
        userId: expiredUser,
        createdByUserId: userId,
        expiresAt: new Date(now.getTime() - DAY),
      },
    ])

  await db()
    .insert(moderationEvents)
    .values([
      {
        siteId: site!.id,
        actorUserId: userId,
        action: 'hide',
        targetType: 'comment',
        targetId: inserted[2]!.id,
        occurredAt: now,
      },
      {
        siteId: site!.id,
        actorUserId: userId,
        action: 'hide',
        targetType: 'comment',
        targetId: inserted[3]!.id,
        occurredAt: yesterday,
      },
      {
        siteId: site!.id,
        actorUserId: userId,
        action: 'pin',
        targetType: 'comment',
        targetId: inserted[0]!.id,
        occurredAt: yesterday,
      },
    ])

  // Static imports would load the better-auth graph before the env vars above.
  const stats = handlerOf((await import('@/routes/api.admin.stats')).Route, 'GET')
  const request = (url: string, headers: Record<string, string> = {}) => stats(new Request(url, { headers }))

  const response = await request(`http://localhost:3000/api/admin/stats?site=${siteKey}&days=7`, { cookie })
  expect(response.status).toBe(200)
  const payload = (await response.json()) as {
    data: {
      stats: {
        totals: {
          comments: number
          visible: number
          hidden: number
          deleted: number
          pages: number
          votesUp: number
          votesDown: number
          blockedUsers: number
        }
        window: { days: number; start: string; comments: number; votesUp: number; votesDown: number }
        series: { day: string; comments: number; visible: number; hidden: number; votesUp: number; votesDown: number }[]
        topPages: { pageId: string; title: string | null; canonicalUrl: string; total: number }[]
        moderationActions: { action: string; count: number }[]
      }
    }
  }
  const { stats: data } = payload.data

  expect(data.totals.comments).toBe(5)
  expect(data.totals.visible).toBe(3)
  expect(data.totals.hidden).toBe(1)
  expect(data.totals.deleted).toBe(1)
  expect(data.totals.pages).toBe(2)
  expect(data.totals.votesUp).toBe(1)
  expect(data.totals.votesDown).toBe(1)
  // The expired block is not a live block.
  expect(data.totals.blockedUsers).toBe(1)

  expect(data.window.days).toBe(7)
  expect(data.series).toHaveLength(7)
  expect(data.series.map((row) => row.day)).toEqual(data.series.map((row) => row.day).toSorted())
  for (const row of data.series) {
    expect(row.day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  }
  // The window covers exactly the seeded days, so the series sum matches the
  // window total and empty days are present as zeros.
  expect(data.window.comments).toBe(data.series.reduce((sum, row) => sum + row.comments, 0))
  expect(data.window.comments).toBe(5)
  expect(data.window.votesUp).toBe(1)
  expect(data.window.votesDown).toBe(1)
  expect(data.series.some((row) => row.comments === 0)).toBe(true)
  const today = data.series[data.series.length - 1]!
  expect(today.comments).toBe(1)
  expect(today.visible).toBe(1)

  // Top threads rank by in-window non-deleted comments.
  expect(data.topPages[0]?.pageId).toBe(page!.id)
  expect(data.topPages[0]?.total).toBe(3)
  expect(data.topPages[0]?.title).toBe('Stats thread')
  expect(data.topPages[1]?.pageId).toBe(quietPage!.id)
  expect(data.topPages[1]?.total).toBe(1)

  const actions = Object.fromEntries(data.moderationActions.map((item) => [item.action, item.count]))
  expect(actions.hide).toBe(2)
  expect(actions.pin).toBe(1)

  // Validation and access failures.
  const badDays = await request(`http://localhost:3000/api/admin/stats?site=${siteKey}&days=45`, { cookie })
  expect(badDays.status).toBe(400)
  const missingSite = await request('http://localhost:3000/api/admin/stats', { cookie })
  expect(missingSite.status).toBe(400)
  const unknownSite = await request(`http://localhost:3000/api/admin/stats?site=does-not-exist`, { cookie })
  expect(unknownSite.status).toBe(404)
  const anonymous = await request(`http://localhost:3000/api/admin/stats?site=${siteKey}`)
  expect(anonymous.status).toBe(401)

  // A session user without membership cannot read the site.
  const outsider = await createSignedInUser()
  const forbidden = await request(`http://localhost:3000/api/admin/stats?site=${otherSiteKey}`, {
    cookie: outsider.cookie,
  })
  expect(forbidden.status).toBe(403)

  await returnInstanceAdmin(adminLoan)
  adminLoan = undefined
})
