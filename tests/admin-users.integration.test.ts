import { afterAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'

import { Route as AdminSettingsRoute } from '@/routes/api.admin.settings'
import { Route as AdminUsersRoute } from '@/routes/api.admin.users'
import { Route as AdminUserCommentsRoute } from '@/routes/api.admin.users.$userId.comments'
import { getBusinessDb } from '@/server/db/business-sql'
import { comments, instanceAdmins, pages, siteMemberships, sites, user, userBlocks } from '@/server/db/schema'
import { listSiteUsers, listUserComments } from '@/server/modules/comments/infrastructure/comment-repository'
import {
  cleanupTestData,
  createSignedInUser,
  createTestComment,
  handlerOf,
  handlerOfParams,
  siteKeys,
  userIds,
} from './helpers/integration'

const db = getBusinessDb()

// The admin slot is a singleton, so the settings test lends it to a fresh
// session user for the duration of the request and puts it back afterwards.
let previousAdminId: string | undefined
let lentAdminUserId: string | undefined

afterAll(async () => {
  if (previousAdminId) await db.update(instanceAdmins).set({ userId: previousAdminId })
  else if (lentAdminUserId) await db.delete(instanceAdmins).where(eq(instanceAdmins.userId, lentAdminUserId))
  await cleanupTestData()
})

const siteKey = `admin-users-${crypto.randomUUID()}`
let siteId = ''

async function insertUser(name: string, email: string, createdAt: Date): Promise<string> {
  const id = crypto.randomUUID()
  userIds.push(id)
  await db.insert(user).values({ id, name, email, createdAt })
  return id
}

type DirectoryIds = { oldestId: string; posterId: string; blockedId: string; newestId: string; expiredId: string }

let directoryIds: DirectoryIds | null = null

async function setupDirectory(): Promise<DirectoryIds> {
  if (directoryIds) return directoryIds
  siteKeys.push(siteKey)
  const [site] = await db.insert(sites).values({ key: siteKey, name: 'Users site' }).returning({ id: sites.id })
  siteId = site!.id
  const [page] = await db
    .insert(pages)
    .values({ siteId, canonicalUrl: 'https://example.test/users', title: 'Users thread' })
    .returning({ id: pages.id })

  // Registration order is explicit so the newest-first assertion is stable.
  const oldestId = await insertUser('Oldest member', 'oldest@example.test', new Date('2026-01-01T00:00:00Z'))
  const posterId = await insertUser('Prolific poster', 'poster@example.test', new Date('2026-02-01T00:00:00Z'))
  const blockedId = await insertUser('Blocked preemptive', 'blocked@example.test', new Date('2026-03-01T00:00:00Z'))
  const newestId = await insertUser('Newest quiet', 'newest@example.test', new Date('2026-04-01T00:00:00Z'))
  await db.insert(siteMemberships).values([
    { siteId, userId: oldestId, role: 'moderator' },
    { siteId, userId: newestId, role: 'admin' },
  ])
  // A preemptive block needs no comment to exist; an expired one stops counting.
  await db.insert(userBlocks).values({ siteId, userId: blockedId, createdByUserId: oldestId })
  const expiredId = await insertUser('Expired block', 'expired@example.test', new Date('2026-01-15T00:00:00Z'))
  await db.insert(userBlocks).values({
    siteId,
    userId: expiredId,
    createdByUserId: oldestId,
    expiresAt: new Date('2020-01-01T00:00:00Z'),
  })

  await db.insert(comments).values([
    {
      pageId: page!.id,
      userId: posterId,
      authorName: 'Prolific poster',
      bodyMarkdown: 'First',
      status: 'visible',
      createdAt: new Date('2026-05-01T00:00:00Z'),
    },
    {
      pageId: page!.id,
      userId: posterId,
      authorName: 'Prolific poster',
      bodyMarkdown: 'Second hidden',
      status: 'hidden',
      createdAt: new Date('2026-05-02T00:00:00Z'),
    },
    {
      pageId: page!.id,
      userId: expiredId,
      authorName: 'Expired block',
      bodyMarkdown: 'Expired author',
      status: 'visible',
      createdAt: new Date('2026-05-03T00:00:00Z'),
    },
    {
      pageId: page!.id,
      userId: null,
      authorName: 'Guest author',
      bodyMarkdown: 'Guest comment',
      status: 'visible',
      createdAt: new Date('2026-05-04T00:00:00Z'),
    },
  ])
  directoryIds = { oldestId, posterId, blockedId, newestId, expiredId }
  return directoryIds
}

const listUsers = handlerOf(AdminUsersRoute, 'GET')
const listHistory = handlerOfParams(AdminUserCommentsRoute, 'GET')
const readSettings = handlerOf(AdminSettingsRoute, 'GET')

describe('site user directory', () => {
  test('rolls up commenters, members and blocked users newest-first, guests excluded', async () => {
    const { oldestId, posterId, blockedId, newestId, expiredId } = (await setupDirectory())!
    const { users, total } = await listSiteUsers(siteId, { limit: 20, offset: 0 })

    // Five registered rows: guests never appear, even though they commented.
    expect(total).toBe(5)
    expect(users.map((row) => row.userId)).toEqual([newestId, blockedId, posterId, expiredId, oldestId])
    expect(users.some((row) => row.name === 'Guest author')).toBe(false)

    const poster = users.find((row) => row.userId === posterId)!
    expect(poster.commentsTotal).toBe(2)
    expect(poster.role).toBeNull()
    expect(poster.blocked).toBe(false)

    const oldest = users.find((row) => row.userId === oldestId)!
    expect(oldest.role).toBe('moderator')
    expect(oldest.commentsTotal).toBe(0)
    expect(oldest.lastCommentAt).toBeNull()

    const blocked = users.find((row) => row.userId === blockedId)!
    expect(blocked.blocked).toBe(true)
    expect(blocked.commentsTotal).toBe(0)

    const expired = users.find((row) => row.userId === expiredId)!
    expect(expired.blocked).toBe(false)
  })

  test('search matches names and emails; the blocked filter and paging hold totals', async () => {
    await setupDirectory()
    const byName = await listSiteUsers(siteId, { search: 'prolific', limit: 20, offset: 0 })
    expect(byName.users.map((row) => row.name)).toEqual(['Prolific poster'])

    const byEmail = await listSiteUsers(siteId, { search: 'OLDEST@EXAMPLE', limit: 20, offset: 0 })
    expect(byEmail.users.map((row) => row.name)).toEqual(['Oldest member'])

    const blockedOnly = await listSiteUsers(siteId, { filter: 'blocked', limit: 20, offset: 0 })
    expect(blockedOnly.total).toBe(1)
    expect(blockedOnly.users.map((row) => row.name)).toEqual(['Blocked preemptive'])

    const first = await listSiteUsers(siteId, { limit: 2, offset: 0 })
    const second = await listSiteUsers(siteId, { limit: 2, offset: 2 })
    expect(first.users).toHaveLength(2)
    expect(second.users).toHaveLength(2)
    expect(first.total).toBe(5)
    expect(second.users.map((row) => row.userId)).not.toEqual(first.users.map((row) => row.userId))
  })

  test('lists one user history newest-first, hidden rows included', async () => {
    const { posterId } = (await setupDirectory())!
    const { comments: history, total } = await listUserComments(siteId, posterId, { limit: 20, offset: 0 })
    expect(total).toBe(2)
    expect(history.map((row) => row.bodyMarkdown)).toEqual(['Second hidden', 'First'])
    expect(history.map((row) => row.status)).toEqual(['hidden', 'visible'])
    expect(history[0]?.pageTitle).toBe('Users thread')

    const paged = await listUserComments(siteId, posterId, { limit: 1, offset: 1 })
    expect(paged.total).toBe(2)
    expect(paged.comments.map((row) => row.bodyMarkdown)).toEqual(['First'])

    const unknown = await listUserComments(siteId, crypto.randomUUID(), { limit: 20, offset: 0 })
    expect(unknown).toEqual({ comments: [], total: 0 })
  })
})

describe('admin users API', () => {
  test('rejects anonymous, foreign and service-key callers; validates paging', async () => {
    await setupDirectory()
    const anonymous = await listUsers(new Request(`http://localhost:3000/api/admin/users?site=${siteKey}`))
    expect(anonymous.status).toBe(401)

    const stranger = await createSignedInUser()
    const foreign = await listUsers(
      new Request(`http://localhost:3000/api/admin/users?site=${siteKey}`, {
        headers: { cookie: stranger.cookie },
      }),
    )
    expect(foreign.status).toBe(403)

    const keyed = await listUsers(
      new Request(`http://localhost:3000/api/admin/users?site=${siteKey}`, {
        headers: { authorization: 'Bearer lck_test' },
      }),
    )
    expect(keyed.status).toBe(401)

    const { userId, cookie } = await createSignedInUser()
    await db.insert(siteMemberships).values({ siteId, userId, role: 'moderator' })
    const invalid = await listUsers(
      new Request(`http://localhost:3000/api/admin/users?site=${siteKey}&limit=0`, { headers: { cookie } }),
    )
    expect(invalid.status).toBe(400)

    const listed = await listUsers(
      new Request(`http://localhost:3000/api/admin/users?site=${siteKey}&filter=blocked`, { headers: { cookie } }),
    )
    expect(listed.status).toBe(200)
    const body = (await listed.json()) as { data: { users: { name: string }[]; total: number } }
    expect(body.data.total).toBe(1)
    expect(body.data.users.map((row) => row.name)).toEqual(['Blocked preemptive'])

    const searched = await listUsers(
      new Request(`http://localhost:3000/api/admin/users?site=${siteKey}&search=poster`, { headers: { cookie } }),
    )
    expect(searched.status).toBe(200)
    const searchedBody = (await searched.json()) as { data: { users: { name: string }[]; total: number } }
    expect(searchedBody.data.total).toBe(1)

    const history = await listHistory(
      new Request(`http://localhost:3000/api/admin/users/x/comments?site=${siteKey}`, { headers: { cookie } }),
      { userId: 'x' },
    )
    expect(history.status).toBe(200)
  })

  test('serves the settings snapshot to instance admins only, with no secrets', async () => {
    const member = await createSignedInUser()
    await db.insert(siteMemberships).values({ siteId, userId: member.userId, role: 'moderator' })
    const forbidden = await readSettings(
      new Request('http://localhost:3000/api/admin/settings', { headers: { cookie: member.cookie } }),
    )
    expect(forbidden.status).toBe(403)

    const previousProviders = Bun.env.AUTH_PROVIDERS
    Bun.env.AUTH_PROVIDERS = 'better-auth'
    try {
      const { userId, cookie } = await createSignedInUser()
      const [currentAdmin] = await db.select({ userId: instanceAdmins.userId }).from(instanceAdmins)
      previousAdminId = currentAdmin?.userId
      if (previousAdminId) {
        await db.update(instanceAdmins).set({ userId })
      } else {
        lentAdminUserId = userId
        await db.insert(instanceAdmins).values({ userId })
      }

      const response = await readSettings(
        new Request('http://localhost:3000/api/admin/settings', { headers: { cookie } }),
      )
      expect(response.status).toBe(200)
      const body = (await response.json()) as {
        data: {
          plugins: { id: string; enabled: boolean; detail: string }[]
          auth: { providers: string[] }
          comments: Record<string, unknown>
          rateLimit: { secretConfigured: boolean; limits: { operation: string }[] }
        }
      }
      const ids = body.data.plugins.map((plugin) => plugin.id).sort()
      expect(ids).toEqual(['filter', 'rate-limit', 'turnstile'])
      expect(body.data.auth.providers).toEqual(['better-auth'])
      expect(body.data.rateLimit.limits.map((limit) => limit.operation).sort()).toEqual([
        'comment.create',
        'comment.delete',
        'comment.edit',
        'comment.vote',
      ])
      // Presence flags only: the snapshot must never carry secret values.
      const serialized = JSON.stringify(body.data)
      for (const secret of [Bun.env.BETTER_AUTH_SECRET, Bun.env.TURNSTILE_SECRET_KEY]) {
        if (secret && secret.length > 0) expect(serialized).not.toContain(secret)
      }
      expect(serialized).not.toContain('secretKey')
    } finally {
      if (previousProviders === undefined) delete Bun.env.AUTH_PROVIDERS
      else Bun.env.AUTH_PROVIDERS = previousProviders
    }
  })
})

describe('user comment creation helper', () => {
  test('registered authors keep their user id on comments', async () => {
    await setupDirectory()
    const authorId = await insertUser('History author', 'history@example.test', new Date('2026-06-01T00:00:00Z'))
    const comment = await createTestComment({
      siteKey,
      pageUrl: 'https://example.test/users',
      userId: authorId,
      authorName: 'History author',
      bodyMarkdown: 'Registered voice',
    })
    expect(comment.userId).toBe(authorId)
  })
})
