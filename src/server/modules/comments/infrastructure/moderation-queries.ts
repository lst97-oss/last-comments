import { and, asc, count, desc, eq, gt, gte, ilike, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm'
import { getBusinessDb } from '@/server/db/business-sql'
import { comments, pages, siteMemberships, siteOrigins, sites, user, userBlocks, votes } from '@/server/db/schema'
import type { MembershipRole } from '@/server/http/route-guards'
import type { Db, VoteValue } from '@/server/modules/comments/infrastructure/comment-types'

export type ModerationComment = {
  id: string
  pageId: string
  pageUrl: string
  pageLocked: boolean
  parentId: string | null
  userId: string | null
  userBlocked: boolean
  authorName: string
  bodyMarkdown: string
  status: 'visible' | 'hidden' | 'deleted'
  pinnedAt: Date | null
  createdAt: Date
  // Vote data rides along so a moderator thread can show and cast votes: the
  // public endpoints are origin-gated, so the dashboard cannot use them.
  score: number
  viewerVote: VoteValue | null
  authorRole: MembershipRole | null
}

export type RecentPreviewComment = {
  id: string
  authorName: string
  bodyMarkdown: string
  status: 'visible' | 'hidden' | 'deleted'
  createdAt: Date
}

export type RecentAuthorRollup = {
  authorName: string
  count: number
}

export type ModerationPageSummary = {
  id: string
  canonicalUrl: string
  pageKey: string | null
  title: string | null
  isLocked: boolean
  total: number
  visible: number
  hidden: number
  deleted: number
  latestAt: Date | null
  latest: {
    id: string
    authorName: string
    bodyMarkdown: string
    status: 'visible' | 'hidden' | 'deleted'
    createdAt: Date
  } | null
  // Recent-window activity for the moderation Recent tab: how many updates
  // landed in the window, who wrote them, and the newest preview rows. Counts
  // include hidden/deleted rows (moderators need them); the Pages tab ignores
  // this field.
  recent: {
    windowDays: number
    count: number
    totalAuthors: number
    authors: RecentAuthorRollup[]
    preview: RecentPreviewComment[]
  }
}

export async function listModerationPages(
  siteId: string,
  options: { pageId?: string; recentDays?: number; previewLimit?: number } = {},
  db: Db = getBusinessDb(),
): Promise<ModerationPageSummary[]> {
  const rows = await db
    .select({
      id: pages.id,
      canonicalUrl: pages.canonicalUrl,
      pageKey: pages.pageKey,
      title: pages.title,
      isLocked: pages.isLocked,
      total: count(comments.id),
      visible: sql<number>`count(*) filter (where ${comments.status} = 'visible')`,
      hidden: sql<number>`count(*) filter (where ${comments.status} = 'hidden')`,
      deleted: sql<number>`count(*) filter (where ${comments.status} = 'deleted')`,
      latestAt: sql<Date | null>`max(${comments.createdAt})`,
      // Newest comment per thread (activity order, hidden rows included): the
      // Recent tab previews it. Tie-break on id matches listModerationComments.
      latestId: sql<
        string | null
      >`(select ${comments.id} from ${comments} where ${comments.pageId} = ${pages.id} order by ${comments.createdAt} desc, ${comments.id} desc limit 1)`,
    })
    .from(pages)
    .leftJoin(comments, eq(comments.pageId, pages.id))
    .where(and(eq(pages.siteId, siteId), options.pageId ? eq(pages.id, options.pageId) : undefined))
    .groupBy(pages.id)
    .orderBy(sql`max(${comments.createdAt}) desc nulls last`, asc(pages.canonicalUrl))
    .limit(100)
  const latestIds = rows.flatMap((row) => (row.latestId === null ? [] : [row.latestId]))
  const latestRows = latestIds.length
    ? await db
        .select({
          id: comments.id,
          authorName: comments.authorName,
          bodyMarkdown: comments.bodyMarkdown,
          status: comments.status,
          createdAt: comments.createdAt,
        })
        .from(comments)
        .where(inArray(comments.id, latestIds))
    : []
  const latestById = new Map(latestRows.map((row) => [row.id, row]))
  const windowDays = options.recentDays ?? 7
  const previewCap = Math.min(Math.max(options.previewLimit ?? 3, 1), 5)
  // `recentDays: 0` is "all time": the window drops its lower bound.
  const windowStart = windowDays > 0 ? new Date(Date.now() - windowDays * 86_400_000) : null
  const pageIds = rows.map((row) => row.id)
  // Newest `previewCap` rows per thread. The window function caps each thread
  // on its own: a flat LIMIT across all threads let one busy thread take every
  // preview slot and left the other threads with none.
  const ranked = db
    .select({
      pageId: comments.pageId,
      id: comments.id,
      authorName: comments.authorName,
      bodyMarkdown: comments.bodyMarkdown,
      status: comments.status,
      createdAt: comments.createdAt,
      rank: sql<number>`row_number() over (partition by ${comments.pageId} order by ${comments.createdAt} desc, ${comments.id} desc)`.as(
        'rank',
      ),
    })
    .from(comments)
    .where(and(inArray(comments.pageId, pageIds), windowStart ? gte(comments.createdAt, windowStart) : undefined))
    .as('ranked')
  const [windowCounts, authorGroups, windowRows] = pageIds.length
    ? await Promise.all([
        db
          .select({ pageId: comments.pageId, count: count(comments.id) })
          .from(comments)
          .where(and(inArray(comments.pageId, pageIds), windowStart ? gte(comments.createdAt, windowStart) : undefined))
          .groupBy(comments.pageId),
        db
          .select({ pageId: comments.pageId, authorName: comments.authorName, count: count(comments.id) })
          .from(comments)
          .where(and(inArray(comments.pageId, pageIds), windowStart ? gte(comments.createdAt, windowStart) : undefined))
          .groupBy(comments.pageId, comments.authorName),
        db
          .select({
            pageId: ranked.pageId,
            id: ranked.id,
            authorName: ranked.authorName,
            bodyMarkdown: ranked.bodyMarkdown,
            status: ranked.status,
            createdAt: ranked.createdAt,
          })
          .from(ranked)
          .where(lte(ranked.rank, previewCap))
          .orderBy(desc(ranked.createdAt), desc(ranked.id)),
      ])
    : [[], [], [] as never[]]
  const countByPage = new Map(windowCounts.map((row) => [row.pageId, Number(row.count)]))
  const authorsByPage = new Map<string, RecentAuthorRollup[]>()
  for (const row of authorGroups) {
    const list = authorsByPage.get(row.pageId) ?? []
    list.push({ authorName: row.authorName, count: Number(row.count) })
    authorsByPage.set(row.pageId, list)
  }
  for (const list of authorsByPage.values()) {
    list.sort((a, b) => b.count - a.count || (a.authorName < b.authorName ? -1 : 1))
  }
  const previewByPage = new Map<string, RecentPreviewComment[]>()
  for (const row of windowRows as RecentPreviewComment[] & { pageId: string }[]) {
    const list = previewByPage.get(row.pageId) ?? []
    if (list.length >= previewCap) continue
    const { pageId: _pageId, ...preview } = row
    list.push(preview)
    previewByPage.set(row.pageId, list)
  }
  return rows.map(({ latestId, ...row }) => ({
    ...row,
    latest: latestId === null ? null : (latestById.get(latestId) ?? null),
    total: Number(row.total),
    visible: Number(row.visible),
    hidden: Number(row.hidden),
    deleted: Number(row.deleted),
    recent: {
      windowDays,
      count: countByPage.get(row.id) ?? 0,
      totalAuthors: authorsByPage.get(row.id)?.length ?? 0,
      authors: (authorsByPage.get(row.id) ?? []).slice(0, 3),
      preview: previewByPage.get(row.id) ?? [],
    },
  }))
}

export type ModerationTakedown = {
  id: string
  pageId: string
  pageTitle: string | null
  canonicalUrl: string
  authorName: string
  bodyMarkdown: string
  status: 'visible' | 'hidden' | 'deleted'
  createdAt: Date
}

// Every hidden or deleted comment of the site inside the window, newest first,
// paged on the server. The Hidden & removed list reads this instead of the
// thread previews, so its total matches the hidden and deleted counts on the
// thread cards. `recentDays: 0` is all time.
export async function listModerationTakedowns(
  siteId: string,
  options: { recentDays?: number; limit: number; offset: number },
  db: Db = getBusinessDb(),
): Promise<{ takedowns: ModerationTakedown[]; total: number }> {
  const windowDays = options.recentDays ?? 7
  const windowStart = windowDays > 0 ? new Date(Date.now() - windowDays * 86_400_000) : null
  const filter = and(
    eq(comments.siteId, siteId),
    inArray(comments.status, ['hidden', 'deleted']),
    windowStart ? gte(comments.createdAt, windowStart) : undefined,
  )
  const [takedowns, totalRows] = await Promise.all([
    db
      .select({
        id: comments.id,
        pageId: comments.pageId,
        pageTitle: pages.title,
        canonicalUrl: pages.canonicalUrl,
        authorName: comments.authorName,
        bodyMarkdown: comments.bodyMarkdown,
        status: comments.status,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .innerJoin(pages, eq(comments.pageId, pages.id))
      .where(filter)
      .orderBy(desc(comments.createdAt), desc(comments.id))
      .limit(options.limit)
      .offset(options.offset),
    db.select({ total: count() }).from(comments).where(filter),
  ])
  return { takedowns, total: Number(totalRows[0].total) }
}

export async function listModerationComments(
  siteId: string,
  options: {
    pageId?: string
    status?: 'visible' | 'hidden' | 'deleted'
    sort?: 'newest' | 'oldest'
    viewerUserId?: string
    limit: number
    offset: number
  },
  db: Db = getBusinessDb(),
): Promise<{ comments: ModerationComment[]; total: number }> {
  const filter = and(
    eq(comments.siteId, siteId),
    options.pageId ? eq(comments.pageId, options.pageId) : undefined,
    options.status ? eq(comments.status, options.status) : undefined,
  )
  const newestFirst = (options.sort ?? 'newest') === 'newest'
  const viewerVote = options.viewerUserId
    ? sql<VoteValue | null>`(select ${votes.value}::int from ${votes} where ${votes.commentId} = ${comments.id} and ${votes.userId} = ${options.viewerUserId})`
    : sql<VoteValue | null>`null`
  const [commentRows, totalRows] = await Promise.all([
    db
      .select({
        id: comments.id,
        pageId: comments.pageId,
        pageUrl: pages.canonicalUrl,
        pageLocked: pages.isLocked,
        parentId: comments.parentId,
        userId: comments.userId,
        userBlocked: sql<boolean>`exists (select 1 from ${userBlocks} where ${userBlocks.siteId} = ${comments.siteId} and ${userBlocks.userId} = ${comments.userId})`,
        authorName: comments.authorName,
        bodyMarkdown: comments.bodyMarkdown,
        status: comments.status,
        pinnedAt: comments.pinnedAt,
        createdAt: comments.createdAt,
        score: sql<number>`(select coalesce(sum(${votes.value}), 0) from ${votes} where ${votes.commentId} = ${comments.id})`,
        viewerVote,
        authorRole: sql<MembershipRole | null>`coalesce(${siteMemberships.role}, case when ${comments.userId} is not null then 'member'::site_role end)`,
      })
      .from(comments)
      .innerJoin(pages, eq(comments.pageId, pages.id))
      .leftJoin(
        siteMemberships,
        and(eq(comments.userId, siteMemberships.userId), eq(comments.siteId, siteMemberships.siteId)),
      )
      .where(filter)
      .orderBy(
        ...(newestFirst ? [desc(comments.createdAt), desc(comments.id)] : [asc(comments.createdAt), asc(comments.id)]),
      )
      .limit(options.limit)
      .offset(options.offset),
    db.select({ total: count() }).from(comments).where(filter),
  ])
  return {
    comments: commentRows.map((row) => ({ ...row, score: Number(row.score) })),
    total: Number(totalRows[0].total),
  }
}

export type SiteUser = {
  userId: string
  name: string
  email: string
  createdAt: Date
  role: MembershipRole
  commentsTotal: number
  lastCommentAt: Date | null
  blocked: boolean
  blockedReason: string | null
  blockedAt: Date | null
}

// The Users tab directory: commenters, members, and actively blocked users
// (a preemptive block needs no comment to exist). Guests (userId NULL) never
// appear here. Ordered newest registration first.
export async function listSiteUsers(
  siteId: string,
  options: { search?: string; filter?: 'all' | 'blocked'; limit: number; offset: number },
  db: Db = getBusinessDb(),
): Promise<{ users: SiteUser[]; total: number }> {
  const now = new Date()
  const [commentStats, memberRows, blockRows] = await Promise.all([
    db
      .select({
        userId: comments.userId,
        total: count(comments.id),
        lastAt: sql<Date | null>`max(${comments.createdAt})`,
      })
      .from(comments)
      .where(and(eq(comments.siteId, siteId), isNotNull(comments.userId)))
      .groupBy(comments.userId),
    db
      .select({ userId: siteMemberships.userId, role: siteMemberships.role })
      .from(siteMemberships)
      .where(eq(siteMemberships.siteId, siteId)),
    db
      .select({ userId: userBlocks.userId, reason: userBlocks.reason, createdAt: userBlocks.createdAt })
      .from(userBlocks)
      .where(and(eq(userBlocks.siteId, siteId), or(isNull(userBlocks.expiresAt), gt(userBlocks.expiresAt, now)))),
  ])
  const blockedByUser = new Map(blockRows.map((row) => [row.userId, row]))
  const roleByUser = new Map(memberRows.map((row) => [row.userId, row.role]))
  const statsByUser = new Map(commentStats.flatMap((row) => (row.userId === null ? [] : [[row.userId, row] as const])))
  const candidateIds =
    options.filter === 'blocked'
      ? [...blockedByUser.keys()]
      : [...new Set([...statsByUser.keys(), ...roleByUser.keys(), ...blockedByUser.keys()])]
  if (candidateIds.length === 0) return { users: [], total: 0 }

  // Escape LIKE wildcards so a search for "100%" does not match everything.
  const needle = options.search?.trim() ?? ''
  const searchFilter =
    needle.length > 0
      ? or(
          ilike(user.name, `%${needle.replace(/[\\%_]/g, (char) => `\\${char}`)}%`),
          ilike(user.email, `%${needle.replace(/[\\%_]/g, (char) => `\\${char}`)}%`),
        )
      : undefined
  const where = and(inArray(user.id, candidateIds), searchFilter)
  const [totalRows, userRows] = await Promise.all([
    db.select({ total: count() }).from(user).where(where),
    db
      .select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt })
      .from(user)
      .where(where)
      .orderBy(desc(user.createdAt))
      .limit(options.limit)
      .offset(options.offset),
  ])
  return {
    users: userRows.map((row) => {
      const stats = statsByUser.get(row.id)
      const block = blockedByUser.get(row.id)
      return {
        userId: row.id,
        name: row.name,
        email: row.email,
        createdAt: row.createdAt,
        role: roleByUser.get(row.id) ?? 'member',
        commentsTotal: Number(stats?.total ?? 0),
        lastCommentAt: stats?.lastAt ?? null,
        blocked: block !== undefined,
        blockedReason: block?.reason ?? null,
        blockedAt: block?.createdAt ?? null,
      }
    }),
    total: Number(totalRows[0]?.total ?? 0),
  }
}

export type UserCommentHistoryItem = {
  id: string
  pageId: string
  pageTitle: string | null
  canonicalUrl: string
  bodyMarkdown: string
  status: 'visible' | 'hidden' | 'deleted'
  createdAt: Date
}

// Every comment one user posted on one site, newest first, hidden and
// deleted rows included (moderator view).
export async function listUserComments(
  siteId: string,
  userId: string,
  options: { limit: number; offset: number },
  db: Db = getBusinessDb(),
): Promise<{ comments: UserCommentHistoryItem[]; total: number }> {
  const filter = and(eq(comments.siteId, siteId), eq(comments.userId, userId))
  const [commentRows, totalRows] = await Promise.all([
    db
      .select({
        id: comments.id,
        pageId: comments.pageId,
        pageTitle: pages.title,
        canonicalUrl: pages.canonicalUrl,
        bodyMarkdown: comments.bodyMarkdown,
        status: comments.status,
        createdAt: comments.createdAt,
      })
      .from(comments)
      .innerJoin(pages, eq(comments.pageId, pages.id))
      .where(filter)
      .orderBy(desc(comments.createdAt), desc(comments.id))
      .limit(options.limit)
      .offset(options.offset),
    db.select({ total: count() }).from(comments).where(filter),
  ])
  return { comments: commentRows, total: Number(totalRows[0]?.total ?? 0) }
}

export async function attachOrigins<T extends { id: string }>(
  db: Db,
  rows: T[],
): Promise<(T & { origins: string[] })[]> {
  if (rows.length === 0) return []
  const originRows = await db
    .select({ siteId: siteOrigins.siteId, origin: siteOrigins.origin })
    .from(siteOrigins)
    .where(
      inArray(
        siteOrigins.siteId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(siteOrigins.origin))
  const originsBySite: Record<string, string[]> = {}
  for (const row of originRows) {
    const list = originsBySite[row.siteId] ?? []
    list.push(row.origin)
    originsBySite[row.siteId] = list
  }
  return rows.map((row) => ({ ...row, origins: originsBySite[row.id] ?? [] }))
}

export async function listModerationSites(userId: string, db: Db = getBusinessDb()) {
  const rows = await db
    .select({
      id: sites.id,
      key: sites.key,
      name: sites.name,
      role: siteMemberships.role,
      access: sites.access,
      gatewayOnly: sites.gatewayOnly,
    })
    .from(siteMemberships)
    .innerJoin(sites, eq(siteMemberships.siteId, sites.id))
    .where(eq(siteMemberships.userId, userId))
    .orderBy(asc(sites.name))
  return attachOrigins(db, rows)
}
