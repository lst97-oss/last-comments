import { afterAll, expect, test } from 'bun:test'

import { eq } from 'drizzle-orm'
import { getBusinessDb } from '@/server/db/business-sql'
import { comments, instanceAdmins, moderationEvents, pages, siteMemberships, sites, votes } from '@/server/db/schema'
import { cleanupTestData, createSignedInUser, handlerOfParams, siteKeys } from './helpers/integration'

// Lazy: another test file's drainAll() closes the shared pool mid-run.
const db = () => getBusinessDb()
const siteKey = `admin-page-detail-${crypto.randomUUID()}`
const otherSiteKey = `admin-page-detail-other-${crypto.randomUUID()}`
// The admin slot is a singleton, so the test lends it to a fresh session user
// for the duration of the request and puts the original back afterwards.
let previousAdminId: string | undefined

const DAY = 24 * 60 * 60 * 1000
const now = new Date()
const yesterday = new Date(now.getTime() - DAY)
const twoDaysAgo = new Date(now.getTime() - 2 * DAY)

afterAll(async () => {
  if (previousAdminId) await db().update(instanceAdmins).set({ userId: previousAdminId })
  await cleanupTestData()
})

test('a page thread reports its own totals, trend, authors and activity', async () => {
  Bun.env.BETTER_AUTH_URL = 'http://localhost:3000'
  Bun.env.BETTER_AUTH_SECRET = 'test-only-secret-at-least-32-characters'
  Bun.env.GOOGLE_CLIENT_ID = 'test-client-id'
  Bun.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'

  const { userId, cookie } = await createSignedInUser()
  const [currentAdmin] = await db().select({ userId: instanceAdmins.userId }).from(instanceAdmins)
  previousAdminId = currentAdmin?.userId
  await db().update(instanceAdmins).set({ userId })

  siteKeys.push(siteKey, otherSiteKey)
  const [site] = await db().insert(sites).values({ key: siteKey, name: 'Detail site' }).returning({ id: sites.id })
  const [otherSite] = await db()
    .insert(sites)
    .values({ key: otherSiteKey, name: 'Other detail site' })
    .returning({ id: sites.id })
  await db().insert(siteMemberships).values({ siteId: site!.id, userId, role: 'admin' })

  const [page] = await db()
    .insert(pages)
    .values({
      siteId: site!.id,
      canonicalUrl: 'https://example.test/detail',
      pageKey: 'detail-thread',
      title: 'Detail thread',
    })
    .returning({ id: pages.id })
  const [otherPage] = await db()
    .insert(pages)
    .values({ siteId: site!.id, canonicalUrl: 'https://example.test/other-detail' })
    .returning({ id: pages.id })
  const [foreignPage] = await db()
    .insert(pages)
    .values({ siteId: otherSite!.id, canonicalUrl: 'https://example.test/foreign' })
    .returning({ id: pages.id })

  const inserted = await db()
    .insert(comments)
    .values([
      {
        pageId: page!.id,
        userId,
        authorName: 'Signed in',
        bodyMarkdown: 'Today',
        status: 'visible',
        createdAt: now,
      },
      {
        pageId: page!.id,
        authorName: 'Guest',
        bodyMarkdown: 'Yesterday',
        status: 'visible',
        createdAt: yesterday,
      },
      {
        pageId: page!.id,
        authorName: 'Guest',
        bodyMarkdown: 'A reply',
        status: 'visible',
        createdAt: yesterday,
      },
      {
        pageId: page!.id,
        authorName: 'Hidden',
        bodyMarkdown: 'Hidden',
        status: 'hidden',
        createdAt: yesterday,
      },
      {
        pageId: page!.id,
        authorName: 'Deleted',
        bodyMarkdown: 'Deleted',
        status: 'deleted',
        createdAt: twoDaysAgo,
      },
      {
        pageId: otherPage!.id,
        authorName: 'Elsewhere',
        bodyMarkdown: 'Other thread',
        status: 'visible',
        createdAt: now,
      },
    ])
    .returning({ id: comments.id })

  // The reply needs a real parent, so it is re-pointed after the insert.
  await db().update(comments).set({ parentId: inserted[1]!.id }).where(eq(comments.id, inserted[2]!.id))
  await db().update(comments).set({ pinnedAt: now }).where(eq(comments.id, inserted[0]!.id))

  await db()
    .insert(votes)
    .values([
      { commentId: inserted[0]!.id, userId, value: 1, createdAt: now },
      { commentId: inserted[1]!.id, userId, value: -1, createdAt: yesterday },
    ])

  await db()
    .insert(moderationEvents)
    .values([
      {
        siteId: site!.id,
        actorUserId: userId,
        action: 'page.lock',
        targetType: 'page',
        targetId: page!.id,
        occurredAt: now,
      },
      {
        siteId: site!.id,
        actorUserId: userId,
        action: 'hide',
        targetType: 'comment',
        targetId: inserted[3]!.id,
        occurredAt: now,
      },
      {
        siteId: site!.id,
        actorUserId: userId,
        action: 'hide',
        targetType: 'comment',
        targetId: inserted[5]!.id,
        occurredAt: now,
      },
      {
        siteId: site!.id,
        actorUserId: userId,
        action: 'user.block',
        targetType: 'user',
        targetId: userId,
        occurredAt: now,
      },
    ])

  // Static imports would load the better-auth graph before the env vars above.
  const detail = handlerOfParams((await import('@/routes/api.admin.pages.$pageId')).Route, 'GET')
  const request = (url: string, headers: Record<string, string> = {}) =>
    detail(new Request(url, { headers }), { pageId: page!.id })

  const response = await request(`http://localhost:3000/api/admin/pages/${page!.id}?site=${siteKey}&days=7`, {
    cookie,
  })
  expect(response.status).toBe(200)
  const payload = (await response.json()) as {
    data: {
      siteName: string
      page: {
        id: string
        canonicalUrl: string
        pageKey: string | null
        title: string | null
        total: number
        visible: number
        hidden: number
      }
      stats: {
        totals: {
          comments: number
          visible: number
          hidden: number
          deleted: number
          votesUp: number
          votesDown: number
          replies: number
          pinned: number
          participants: number
        }
        window: { days: number; start: string; comments: number; votesUp: number; votesDown: number }
        series: { day: string; comments: number; visible: number; hidden: number; votesUp: number; votesDown: number }[]
        topAuthors: { authorName: string; total: number }[]
        moderationActions: { action: string; count: number }[]
        firstAt: string | null
      }
    }
  }
  const { siteName, page: pageRow, stats } = payload.data

  expect(siteName).toBe('Detail site')
  expect(pageRow.id).toBe(page!.id)
  expect(pageRow.pageKey).toBe('detail-thread')
  expect(pageRow.title).toBe('Detail thread')
  // The thread summary counts only this page.
  expect(pageRow.total).toBe(5)
  expect(pageRow.visible).toBe(3)
  expect(pageRow.hidden).toBe(1)

  expect(stats.totals.comments).toBe(5)
  expect(stats.totals.visible).toBe(3)
  expect(stats.totals.hidden).toBe(1)
  expect(stats.totals.deleted).toBe(1)
  expect(stats.totals.votesUp).toBe(1)
  expect(stats.totals.votesDown).toBe(1)
  expect(stats.totals.replies).toBe(1)
  expect(stats.totals.pinned).toBe(1)
  // Distinct people who posted: the signed-in user, "Guest" (twice, counted
  // once), "Hidden" and "Deleted" still count as participants.
  expect(stats.totals.participants).toBe(4)
  expect(stats.firstAt).not.toBeNull()

  expect(stats.window.days).toBe(7)
  expect(stats.series).toHaveLength(7)
  expect(stats.series.map((row) => row.day)).toEqual(stats.series.map((row) => row.day).toSorted())
  expect(stats.window.comments).toBe(stats.series.reduce((sum, row) => sum + row.comments, 0))
  // All five comments of this page fall inside the window; the comment on
  // the other page is not part of this thread.
  expect(stats.window.comments).toBe(5)
  expect(stats.window.votesUp).toBe(1)
  expect(stats.window.votesDown).toBe(1)
  const today = stats.series[stats.series.length - 1]!
  expect(today.comments).toBe(1)
  expect(today.visible).toBe(1)

  const authors = Object.fromEntries(stats.topAuthors.map((row) => [row.authorName, row.total]))
  expect(authors.Guest).toBe(2)
  expect(authors['Signed in']).toBe(1)

  // Only the page's own events and the events of its comments count.
  const actions = Object.fromEntries(stats.moderationActions.map((item) => [item.action, item.count]))
  expect(actions['page.lock']).toBe(1)
  expect(actions.hide).toBe(1)
  expect(actions['user.block']).toBeUndefined()

  // Validation and access failures.
  const badDays = await request(`http://localhost:3000/api/admin/pages/${page!.id}?site=${siteKey}&days=45`, {
    cookie,
  })
  expect(badDays.status).toBe(400)
  const missingSite = await request(`http://localhost:3000/api/admin/pages/${page!.id}`, { cookie })
  expect(missingSite.status).toBe(400)
  const badUuid = await detail(new Request(`http://localhost:3000/api/admin/pages/not-a-uuid?site=${siteKey}`), {
    pageId: 'not-a-uuid',
  })
  expect(badUuid.status).toBe(400)
  const unknownSite = await request(`http://localhost:3000/api/admin/pages/${page!.id}?site=does-not-exist`, {
    cookie,
  })
  expect(unknownSite.status).toBe(404)
  const unknownPage = await detail(
    new Request(`http://localhost:3000/api/admin/pages/${crypto.randomUUID()}?site=${siteKey}`, {
      headers: { cookie },
    }),
    { pageId: crypto.randomUUID() },
  )
  expect(unknownPage.status).toBe(404)
  // A page of another site is a 404 here, never another site's thread.
  const foreign = await detail(
    new Request(`http://localhost:3000/api/admin/pages/${foreignPage!.id}?site=${siteKey}`, { headers: { cookie } }),
    {
      pageId: foreignPage!.id,
    },
  )
  expect(foreign.status).toBe(404)
  const anonymous = await request(`http://localhost:3000/api/admin/pages/${page!.id}?site=${siteKey}`)
  expect(anonymous.status).toBe(401)

  // A session user without membership cannot read the site.
  const outsider = await createSignedInUser()
  const forbidden = await request(`http://localhost:3000/api/admin/pages/${page!.id}?site=${otherSiteKey}`, {
    cookie: outsider.cookie,
  })
  expect(forbidden.status).toBe(403)

  await db().update(instanceAdmins).set({ userId: previousAdminId })
  previousAdminId = undefined
})
