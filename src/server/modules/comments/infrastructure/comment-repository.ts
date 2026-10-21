import { timingSafeEqual } from 'node:crypto'

import { and, asc, count, desc, eq, gt, gte, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { getBusinessDb } from '@/server/db/business-sql'
import {
  comments,
  moderationEvents,
  pages,
  pluginDeliveries,
  pluginEvents,
  siteMemberships,
  siteOrigins,
  sites,
  user,
  userBlocks,
  votes,
} from '@/server/db/schema'
import { HttpError } from '@/server/http/errors'
import { getMembershipRole, type MembershipRole } from '@/server/http/route-guards'
import type { CommentCreationContext, CreateCommentData } from '@/server/modules/comments/application/create-comment'
import { normalizePageKey, normalizePageUrl } from '@/server/modules/comments/domain/comment'
import {
  type CommentEventType,
  EMPTY_SCREENING,
  getCommentEditSettings,
  getCommentPlugins,
  type ScreenVerdict,
  subscribedPlugins,
} from '@/server/plugins/comment-plugins'

type Db = ReturnType<typeof getBusinessDb>
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0]
export type VoteValue = -1 | 1
export type CommentVoteSummary = { score: number; viewerVote: VoteValue | null }

const EDIT_KEY_BYTES = 32

function createEditKey(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(EDIT_KEY_BYTES))).toString('base64url')
}

async function hashEditKey(editKey: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(editKey))
  return Buffer.from(digest).toString('hex')
}

async function matchesEditKey(editKey: string, storedHash: string): Promise<boolean> {
  const presented = Buffer.from(await hashEditKey(editKey), 'hex')
  const stored = Buffer.from(storedHash, 'hex')
  return presented.length === stored.length && timingSafeEqual(presented, stored)
}

// Never serialize the stored hash: only the plaintext key returned at create
// time may reach the client.
function withoutEditKeyHash<T extends { editKeyHash: string | null }>(row: T): Omit<T, 'editKeyHash'> {
  const { editKeyHash: _editKeyHash, ...rest } = row
  return rest
}

export async function assertSiteOrigin(
  siteKey: string,
  origin: string | null,
  db: Db = getBusinessDb(),
): Promise<string | null> {
  if (!origin) return null

  let normalizedOrigin: string
  try {
    normalizedOrigin = new URL(origin).origin
  } catch {
    throw new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed')
  }

  const [allowed] = await db
    .select({ origin: siteOrigins.origin })
    .from(siteOrigins)
    .innerJoin(sites, eq(siteOrigins.siteId, sites.id))
    .where(and(eq(sites.key, siteKey), eq(siteOrigins.origin, normalizedOrigin)))
    .limit(1)
  if (!allowed) throw new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed')
  return normalizedOrigin
}

// Write paths (comment create/edit/delete, vote) require an origin; reads
// tolerate a missing one because browsers omit Origin on same-origin GET.
export async function requireAllowedOrigin(
  siteKey: string,
  origin: string | null,
  db: Db = getBusinessDb(),
): Promise<string> {
  const allowedOrigin = await assertSiteOrigin(siteKey, origin, db)
  if (!allowedOrigin) throw new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed')
  return allowedOrigin
}

async function assertCommenterAllowed(tx: Transaction, siteId: string, userId: string, message: string): Promise<void> {
  const [block] = await tx
    .select({ id: userBlocks.id })
    .from(userBlocks)
    .where(
      and(
        eq(userBlocks.siteId, siteId),
        eq(userBlocks.userId, userId),
        or(isNull(userBlocks.expiresAt), gt(userBlocks.expiresAt, new Date())),
      ),
    )
    .limit(1)
  if (block) throw new HttpError(403, 'USER_BLOCKED', message)
}

export async function getSiteId(siteKey: string, db: Db = getBusinessDb()): Promise<string> {
  const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey)).limit(1)
  if (!site) throw new HttpError(404, 'SITE_NOT_FOUND', 'Site was not found')
  return site.id
}

// Site-scoped on purpose: the moderator composer addresses a thread by page id
// and must never reach another site's page.
export async function getPageCanonicalUrl(
  siteId: string,
  pageId: string,
  db: Db = getBusinessDb(),
): Promise<string | null> {
  const [page] = await db
    .select({ canonicalUrl: pages.canonicalUrl })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.id, pageId)))
    .limit(1)
  return page?.canonicalUrl ?? null
}

export async function prepareCommentCreation(
  data: CreateCommentData,
  db: Db = getBusinessDb(),
): Promise<CommentCreationContext> {
  const pageUrl = normalizePageUrl(data.pageUrl)
  const pageKey = data.pageKey === undefined ? undefined : normalizePageKey(data.pageKey)

  return { siteId: await getSiteId(data.siteKey, db), pageUrl, pageKey }
}

// Thread identity lives here so comment creation and the publisher API
// (POST /api/admin/pages) cannot drift: a slug names the thread and the URL
// follows it, while URL-only threads stay bound to their exact URL.
async function resolvePage(
  tx: Transaction,
  input: { siteId: string; pageUrl: string; pageKey?: string; title?: string },
): Promise<string> {
  const { siteId, pageUrl, pageKey } = input
  const title = input.title?.trim() || null
  let pageId: string
  if (pageKey === undefined) {
    await tx
      .insert(pages)
      .values({ siteId, canonicalUrl: pageUrl, title })
      .onConflictDoNothing({ target: [pages.siteId, pages.canonicalUrl] })
    const [urlPage] = await tx
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.siteId, siteId), eq(pages.canonicalUrl, pageUrl)))
      .limit(1)
    pageId = urlPage.id
  } else {
    const [keyThread] = await tx
      .select({ id: pages.id })
      .from(pages)
      .where(and(eq(pages.siteId, siteId), eq(pages.pageKey, pageKey)))
      .limit(1)
    const [urlThread] = await tx
      .select({ id: pages.id, pageKey: pages.pageKey })
      .from(pages)
      .where(and(eq(pages.siteId, siteId), eq(pages.canonicalUrl, pageUrl)))
      .limit(1)
    if (keyThread && urlThread && keyThread.id !== urlThread.id) {
      throw new HttpError(409, 'PAGE_KEY_MISMATCH', 'This page key belongs to a different thread')
    }
    if (keyThread && urlThread) {
      if (title !== null) {
        await tx.update(pages).set({ title, updatedAt: new Date() }).where(eq(pages.id, keyThread.id))
      }
      pageId = keyThread.id
    } else if (keyThread) {
      // Known slug on a new URL — the page moved; the thread keeps its id.
      await tx
        .update(pages)
        .set({ canonicalUrl: pageUrl, ...(title !== null ? { title } : {}), updatedAt: new Date() })
        .where(eq(pages.id, keyThread.id))
      pageId = keyThread.id
    } else if (urlThread) {
      // Existing URL thread gaining its first slug — claim it, never merge threads.
      if (urlThread.pageKey !== null) {
        throw new HttpError(409, 'PAGE_KEY_MISMATCH', 'This URL already belongs to a different page key')
      }
      await tx
        .update(pages)
        .set({ pageKey, ...(title !== null ? { title } : {}), updatedAt: new Date() })
        .where(eq(pages.id, urlThread.id))
      pageId = urlThread.id
    } else {
      const [inserted] = await tx
        .insert(pages)
        .values({ siteId, canonicalUrl: pageUrl, pageKey, title })
        .returning({ id: pages.id })
      pageId = inserted.id
    }
  }
  return pageId
}

export type PersistedComment = Omit<typeof comments.$inferSelect, 'editKeyHash'> & {
  editKey?: string
  authorRole: MembershipRole | null
}

export async function persistComment(
  data: CreateCommentData,
  context: CommentCreationContext,
  screening: ScreenVerdict = EMPTY_SCREENING,
  db: Db = getBusinessDb(),
): Promise<PersistedComment> {
  const { siteId, pageUrl, pageKey } = context
  // Advisory screening holds hits for review instead of rejecting the write.
  // No `moderationEvents` row is written here: that table requires a human
  // `actorUserId` FK and auto-hide has no actor — the outbox payload carries
  // the reasons and the review queue reads `status` directly.
  const initialStatus = screening.decision === 'hide' ? 'hidden' : 'visible'
  return db.transaction(async (tx) => {
    if (data.userId) await assertCommenterAllowed(tx, siteId, data.userId, 'You cannot comment on this site')

    const pageId = await resolvePage(tx, {
      siteId,
      pageUrl,
      pageKey,
      ...(data.title === undefined ? {} : { title: data.title }),
    })
    const [page] = await tx
      .select({ id: pages.id, isLocked: pages.isLocked })
      .from(pages)
      .where(and(eq(pages.siteId, siteId), eq(pages.id, pageId)))
      .limit(1)
    if (!page) throw new HttpError(500, 'PAGE_UNAVAILABLE', 'Page could not be created')
    if (page.isLocked) throw new HttpError(409, 'PAGE_LOCKED', 'Comments are disabled for this page')

    if (data.parentId) {
      const [parent] = await tx
        .select({ id: comments.id })
        .from(comments)
        .where(and(eq(comments.id, data.parentId), eq(comments.pageId, page.id), eq(comments.status, 'visible')))
        .limit(1)
      if (!parent) throw new HttpError(404, 'PARENT_NOT_FOUND', 'Reply target was not found')
    }

    const editKey = data.userId ? null : createEditKey()
    const [comment] = await tx
      .insert(comments)
      .values({
        pageId: page.id,
        parentId: data.parentId ?? null,
        userId: data.userId,
        authorName: data.authorName.trim(),
        bodyMarkdown: data.bodyMarkdown.trim(),
        status: initialStatus,
        editKeyHash: editKey ? await hashEditKey(editKey) : null,
      })
      .returning()
    await enqueuePluginEvent(tx, {
      siteId,
      type: 'comment.created',
      aggregateId: comment.id,
      payload: {
        commentId: comment.id,
        pageId: page.id,
        pageUrl,
        authorName: comment.authorName,
        userId: comment.userId,
        bodyMarkdown: comment.bodyMarkdown,
        ...(initialStatus === 'hidden'
          ? { autoHidden: true, reasons: screening.reasons, triggeredCategories: screening.triggeredCategories }
          : {}),
      },
    })

    const authorRole = data.userId ? await getMembershipRole(siteId, data.userId) : null
    const safeComment = { ...withoutEditKeyHash(comment), authorRole }
    // The plaintext key is returned exactly once; only its hash is stored.
    return editKey ? { ...safeComment, editKey } : safeComment
  })
}

async function findOwnedComment(tx: Transaction, siteKey: string, commentId: string, userId: string) {
  const [comment] = await tx
    .select({
      id: comments.id,
      pageId: comments.pageId,
      siteId: pages.siteId,
      status: comments.status,
      pageLocked: pages.isLocked,
      createdAt: comments.createdAt,
      editKeyHash: comments.editKeyHash,
    })
    .from(comments)
    .innerJoin(pages, eq(comments.pageId, pages.id))
    .innerJoin(sites, eq(pages.siteId, sites.id))
    .where(and(eq(sites.key, siteKey), eq(comments.id, commentId), eq(comments.userId, userId)))
    .limit(1)
  if (!comment) throw new HttpError(404, 'COMMENT_NOT_FOUND', 'Comment was not found')
  return comment
}

async function findGuestComment(tx: Transaction, siteKey: string, commentId: string, editKey: string) {
  const [comment] = await tx
    .select({
      id: comments.id,
      pageId: comments.pageId,
      siteId: pages.siteId,
      status: comments.status,
      pageLocked: pages.isLocked,
      createdAt: comments.createdAt,
      editKeyHash: comments.editKeyHash,
    })
    .from(comments)
    .innerJoin(pages, eq(comments.pageId, pages.id))
    .innerJoin(sites, eq(pages.siteId, sites.id))
    .where(and(eq(sites.key, siteKey), eq(comments.id, commentId), isNull(comments.userId)))
    .limit(1)
  // A wrong key is indistinguishable from a missing comment: callers must not
  // be able to probe which guest comments exist.
  if (!comment?.editKeyHash || !(await matchesEditKey(editKey, comment.editKeyHash))) {
    throw new HttpError(404, 'COMMENT_NOT_FOUND', 'Comment was not found')
  }
  return { ...comment, editKeyHash: comment.editKeyHash }
}

export async function editOwnComment(
  data: {
    siteKey: string
    commentId: string
    userId: string | null
    bodyMarkdown: string
    editKey?: string
    anonWindowMinutes?: number
  },
  // Advisory re-screening: a `hide` verdict flips the edited row to `hidden`
  // for review. Already-hidden rows never reach here (404 above), so screening
  // only ever promotes `visible → hidden`, never the reverse.
  screening: ScreenVerdict = EMPTY_SCREENING,
  db: Db = getBusinessDb(),
) {
  return db.transaction(async (tx) => {
    // Signed-in authors edit any time; guests must present the key issued at
    // create time and stay inside the anonymous window.
    const target = data.userId
      ? await findOwnedComment(tx, data.siteKey, data.commentId, data.userId)
      : await findGuestComment(tx, data.siteKey, data.commentId, data.editKey ?? '')
    if (target.status !== 'visible') throw new HttpError(404, 'COMMENT_NOT_FOUND', 'Comment was not found')
    if (!data.userId) {
      const anonWindowMinutes = data.anonWindowMinutes ?? getCommentEditSettings().anonWindowMinutes
      if (anonWindowMinutes > 0 && Date.now() - target.createdAt.getTime() > anonWindowMinutes * 60_000)
        throw new HttpError(403, 'EDIT_WINDOW_EXPIRED', 'The edit window for this comment has expired')
    }
    if (target.pageLocked) throw new HttpError(409, 'PAGE_LOCKED', 'Comments are disabled for this page')

    if (data.userId) await assertCommenterAllowed(tx, target.siteId, data.userId, 'You cannot comment on this site')

    const hideOnEdit = screening.decision === 'hide'
    const now = new Date()
    const [comment] = await tx
      .update(comments)
      .set({
        bodyMarkdown: data.bodyMarkdown.trim(),
        editedAt: now,
        updatedAt: now,
        ...(hideOnEdit ? { status: 'hidden' as const } : {}),
      })
      .where(
        and(
          eq(comments.id, data.commentId),
          eq(comments.pageId, target.pageId),
          // The guest key was already verified; the row stays guest-owned.
          data.userId ? eq(comments.userId, data.userId) : isNull(comments.userId),
          eq(comments.status, 'visible'),
        ),
      )
      .returning()
    if (!comment) throw new HttpError(404, 'COMMENT_NOT_FOUND', 'Comment was not found')

    await enqueuePluginEvent(tx, {
      siteId: target.siteId,
      type: 'comment.edited',
      aggregateId: comment.id,
      payload: {
        commentId: comment.id,
        userId: data.userId,
        bodyMarkdown: comment.bodyMarkdown,
        ...(hideOnEdit
          ? { autoHidden: true, reasons: screening.reasons, triggeredCategories: screening.triggeredCategories }
          : {}),
      },
    })
    const authorRole = data.userId ? await getMembershipRole(target.siteId, data.userId) : null
    return { ...withoutEditKeyHash(comment), authorRole }
  })
}

export async function deleteOwnComment(
  data: { siteKey: string; commentId: string; userId: string },
  db: Db = getBusinessDb(),
) {
  return db.transaction(async (tx) => {
    const target = await findOwnedComment(tx, data.siteKey, data.commentId, data.userId)
    if (target.status === 'deleted') throw new HttpError(404, 'COMMENT_NOT_FOUND', 'Comment was not found')

    const now = new Date()
    const [comment] = await tx
      .update(comments)
      .set({ status: 'deleted', deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(comments.id, data.commentId),
          eq(comments.pageId, target.pageId),
          eq(comments.userId, data.userId),
          inArray(comments.status, ['visible', 'hidden']),
        ),
      )
      .returning()
    if (!comment) throw new HttpError(404, 'COMMENT_NOT_FOUND', 'Comment was not found')

    await enqueuePluginEvent(tx, {
      siteId: target.siteId,
      type: 'comment.deleted',
      aggregateId: comment.id,
      payload: { commentId: comment.id, action: 'delete', userId: data.userId },
    })
    return withoutEditKeyHash(comment)
  })
}

export async function listPageComments(
  siteKey: string,
  pageUrl: string,
  options: { limit: number; offset: number; viewerUserId?: string | null; pageKey?: string },
  db: Db = getBusinessDb(),
) {
  const normalizedKey = options.pageKey === undefined ? undefined : normalizePageKey(options.pageKey)
  const pageFilter =
    normalizedKey === undefined ? eq(pages.canonicalUrl, normalizePageUrl(pageUrl)) : eq(pages.pageKey, normalizedKey)
  const [page] = await db
    .select({ id: pages.id })
    .from(pages)
    .innerJoin(sites, eq(pages.siteId, sites.id))
    .where(and(eq(sites.key, siteKey), pageFilter))
    .limit(1)
  if (!page) return []

  const commentRows = await db
    .select({
      id: comments.id,
      pageId: comments.pageId,
      parentId: comments.parentId,
      userId: comments.userId,
      authorName: comments.authorName,
      avatarUrl: user.image,
      bodyMarkdown: comments.bodyMarkdown,
      status: comments.status,
      pinnedAt: comments.pinnedAt,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
      authorRole: siteMemberships.role,
    })
    .from(comments)
    .leftJoin(user, eq(comments.userId, user.id))
    .innerJoin(pages, eq(comments.pageId, pages.id))
    .leftJoin(
      siteMemberships,
      and(eq(comments.userId, siteMemberships.userId), eq(pages.siteId, siteMemberships.siteId)),
    )
    .where(and(eq(comments.pageId, page.id), eq(comments.status, 'visible')))
    .orderBy(asc(comments.createdAt), asc(comments.id))
    .limit(options.limit)
    .offset(options.offset)

  if (commentRows.length === 0) return []

  const voteRows = await db
    .select({
      commentId: votes.commentId,
      score: sql<number>`cast(coalesce(sum(${votes.value}), 0) as integer)`,
      viewerVote: sql<VoteValue | null>`cast(max(case when ${votes.userId} = ${options.viewerUserId ?? null} then ${votes.value} end) as integer)`,
    })
    .from(votes)
    .where(
      inArray(
        votes.commentId,
        commentRows.map((comment) => comment.id),
      ),
    )
    .groupBy(votes.commentId)

  const summaries = new Map(voteRows.map(({ commentId, ...summary }) => [commentId, summary]))
  return commentRows.map((comment) => ({
    ...comment,
    ...(summaries.get(comment.id) ?? { score: 0, viewerVote: null }),
  }))
}

async function assertCanVote(tx: Transaction, siteKey: string, commentId: string, userId: string) {
  const [target] = await tx
    .select({ siteId: sites.id, status: comments.status, pageLocked: pages.isLocked })
    .from(comments)
    .innerJoin(pages, eq(comments.pageId, pages.id))
    .innerJoin(sites, eq(pages.siteId, sites.id))
    .where(and(eq(sites.key, siteKey), eq(comments.id, commentId)))
    .limit(1)
  if (target?.status !== 'visible') {
    throw new HttpError(404, 'COMMENT_NOT_FOUND', 'Comment was not found')
  }
  if (target.pageLocked) throw new HttpError(409, 'PAGE_LOCKED', 'Comments are disabled for this page')

  await assertCommenterAllowed(tx, target.siteId, userId, 'You cannot vote on this site')
  return target
}

async function getCommentVoteSummary(tx: Transaction, commentId: string, userId: string): Promise<CommentVoteSummary> {
  const [summary] = await tx
    .select({
      score: sql<number>`cast(coalesce(sum(${votes.value}), 0) as integer)`,
      viewerVote: sql<VoteValue | null>`cast(max(case when ${votes.userId} = ${userId} then ${votes.value} end) as integer)`,
    })
    .from(votes)
    .where(eq(votes.commentId, commentId))
  return summary
}

export async function castCommentVote(
  siteKey: string,
  commentId: string,
  userId: string,
  value: VoteValue,
  db: Db = getBusinessDb(),
): Promise<CommentVoteSummary> {
  return db.transaction(async (tx) => {
    await assertCanVote(tx, siteKey, commentId, userId)
    await tx
      .insert(votes)
      .values({ commentId, userId, value })
      .onConflictDoUpdate({
        target: [votes.commentId, votes.userId],
        set: { value },
      })
    return getCommentVoteSummary(tx, commentId, userId)
  })
}

export async function clearCommentVote(
  siteKey: string,
  commentId: string,
  userId: string,
  db: Db = getBusinessDb(),
): Promise<CommentVoteSummary> {
  return db.transaction(async (tx) => {
    await assertCanVote(tx, siteKey, commentId, userId)
    await tx.delete(votes).where(and(eq(votes.commentId, commentId), eq(votes.userId, userId)))
    return getCommentVoteSummary(tx, commentId, userId)
  })
}

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
  const windowStart = new Date(Date.now() - windowDays * 86_400_000)
  const pageIds = rows.map((row) => row.id)
  const [windowCounts, authorGroups, windowRows] = pageIds.length
    ? await Promise.all([
        db
          .select({ pageId: comments.pageId, count: count(comments.id) })
          .from(comments)
          .where(and(inArray(comments.pageId, pageIds), gte(comments.createdAt, windowStart)))
          .groupBy(comments.pageId),
        db
          .select({ pageId: comments.pageId, authorName: comments.authorName, count: count(comments.id) })
          .from(comments)
          .where(and(inArray(comments.pageId, pageIds), gte(comments.createdAt, windowStart)))
          .groupBy(comments.pageId, comments.authorName),
        db
          .select({
            pageId: comments.pageId,
            id: comments.id,
            authorName: comments.authorName,
            bodyMarkdown: comments.bodyMarkdown,
            status: comments.status,
            createdAt: comments.createdAt,
          })
          .from(comments)
          .where(and(inArray(comments.pageId, pageIds), gte(comments.createdAt, windowStart)))
          .orderBy(desc(comments.createdAt), desc(comments.id))
          .limit(pageIds.length * previewCap),
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
    recent: {
      windowDays,
      count: countByPage.get(row.id) ?? 0,
      totalAuthors: authorsByPage.get(row.id)?.length ?? 0,
      authors: (authorsByPage.get(row.id) ?? []).slice(0, 3),
      preview: previewByPage.get(row.id) ?? [],
    },
  }))
}

export type SiteDashboardStats = {
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
  series: {
    day: string
    comments: number
    visible: number
    hidden: number
    votesUp: number
    votesDown: number
  }[]
  topPages: { pageId: string; title: string | null; canonicalUrl: string; total: number }[]
  moderationActions: { action: string; count: number }[]
}

export async function getSiteStats(
  siteId: string,
  days: 7 | 30 | 90,
  db: Db = getBusinessDb(),
): Promise<SiteDashboardStats> {
  // UTC midnight of the first day in the window; the series spine uses the
  // same boundary so the top-pages and moderation counts line up with it.
  const now = new Date()
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)))

  const [commentTotals, pageTotals, voteTotals, blockTotals, topPages, moderationActions] = await Promise.all([
    db
      .select({
        comments: count(comments.id),
        visible: sql<number>`count(*) filter (where ${comments.status} = 'visible')`,
        hidden: sql<number>`count(*) filter (where ${comments.status} = 'hidden')`,
        deleted: sql<number>`count(*) filter (where ${comments.status} = 'deleted')`,
      })
      .from(comments)
      .innerJoin(pages, eq(comments.pageId, pages.id))
      .where(eq(pages.siteId, siteId)),
    db.select({ pages: count() }).from(pages).where(eq(pages.siteId, siteId)),
    db
      .select({
        votesUp: sql<number>`count(*) filter (where ${votes.value} = 1)`,
        votesDown: sql<number>`count(*) filter (where ${votes.value} = -1)`,
      })
      .from(votes)
      .innerJoin(comments, eq(votes.commentId, comments.id))
      .innerJoin(pages, eq(comments.pageId, pages.id))
      .where(eq(pages.siteId, siteId)),
    db
      .select({ blockedUsers: count() })
      .from(userBlocks)
      .where(and(eq(userBlocks.siteId, siteId), or(isNull(userBlocks.expiresAt), gt(userBlocks.expiresAt, now)))),
    db
      .select({
        pageId: pages.id,
        title: pages.title,
        canonicalUrl: pages.canonicalUrl,
        total: count(comments.id),
      })
      .from(comments)
      .innerJoin(pages, eq(comments.pageId, pages.id))
      .where(
        and(
          eq(pages.siteId, siteId),
          gte(comments.createdAt, windowStart),
          inArray(comments.status, ['visible', 'hidden']),
        ),
      )
      .groupBy(pages.id, pages.title, pages.canonicalUrl)
      .orderBy(desc(count(comments.id)))
      .limit(5),
    db
      .select({ action: moderationEvents.action, count: count() })
      .from(moderationEvents)
      .where(and(eq(moderationEvents.siteId, siteId), gte(moderationEvents.occurredAt, windowStart)))
      .groupBy(moderationEvents.action)
      .orderBy(desc(count())),
  ])

  const seriesRows = await db.execute<{
    day: string
    comments: number
    visible: number
    hidden: number
    votesUp: number
    votesDown: number
  }>(sql`
    with days as (
      select generate_series(
        date_trunc('day', now() - ((${days} - 1) * interval '1 day')),
        date_trunc('day', now()),
        interval '1 day'
      ) as day
    ),
    comment_days as (
      select date_trunc('day', c.created_at) as day,
        count(*)::int as comments,
        count(*) filter (where c.status = 'visible')::int as visible,
        count(*) filter (where c.status = 'hidden')::int as hidden
      from comments c
      join pages p on p.id = c.page_id
      where p.site_id = ${siteId} and c.created_at >= (select min(day) from days)
      group by 1
    ),
    vote_days as (
      select date_trunc('day', v.created_at) as day,
        count(*) filter (where v.value = 1)::int as up,
        count(*) filter (where v.value = -1)::int as down
      from votes v
      join comments c on c.id = v.comment_id
      join pages p on p.id = c.page_id
      where p.site_id = ${siteId} and v.created_at >= (select min(day) from days)
      group by 1
    )
    select to_char(days.day, 'YYYY-MM-DD') as day,
      coalesce(comment_days.comments, 0)::int as comments,
      coalesce(comment_days.visible, 0)::int as visible,
      coalesce(comment_days.hidden, 0)::int as hidden,
      coalesce(vote_days.up, 0)::int as "votesUp",
      coalesce(vote_days.down, 0)::int as "votesDown"
    from days
    left join comment_days on comment_days.day = days.day
    left join vote_days on vote_days.day = days.day
    order by days.day
  `)

  const series = seriesRows.map((row) => ({
    day: row.day,
    comments: Number(row.comments),
    visible: Number(row.visible),
    hidden: Number(row.hidden),
    votesUp: Number(row.votesUp),
    votesDown: Number(row.votesDown),
  }))

  const commentTotalsRow = commentTotals[0]
  return {
    totals: {
      comments: Number(commentTotalsRow?.comments ?? 0),
      visible: Number(commentTotalsRow?.visible ?? 0),
      hidden: Number(commentTotalsRow?.hidden ?? 0),
      deleted: Number(commentTotalsRow?.deleted ?? 0),
      pages: Number(pageTotals[0]?.pages ?? 0),
      votesUp: Number(voteTotals[0]?.votesUp ?? 0),
      votesDown: Number(voteTotals[0]?.votesDown ?? 0),
      blockedUsers: Number(blockTotals[0]?.blockedUsers ?? 0),
    },
    window: {
      days,
      start: series[0]?.day ?? windowStart.toISOString().slice(0, 10),
      comments: series.reduce((sum, row) => sum + row.comments, 0),
      votesUp: series.reduce((sum, row) => sum + row.votesUp, 0),
      votesDown: series.reduce((sum, row) => sum + row.votesDown, 0),
    },
    series,
    topPages: topPages.map((row) => ({
      pageId: row.pageId,
      title: row.title,
      canonicalUrl: row.canonicalUrl,
      total: Number(row.total),
    })),
    moderationActions: moderationActions.map((row) => ({
      action: row.action,
      count: Number(row.count),
    })),
  }
}

export type PageThreadStats = {
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
  series: {
    day: string
    comments: number
    visible: number
    hidden: number
    votesUp: number
    votesDown: number
  }[]
  topAuthors: { authorName: string; total: number }[]
  moderationActions: { action: string; count: number }[]
  firstAt: Date | null
}

export type PageThreadDetail = {
  siteName: string
  page: ModerationPageSummary
  stats: PageThreadStats
}

// One thread of one site: the page summary plus its own aggregates. The
// page is always addressed inside the site, so a page id from another site
// is a 404 here and never leaks its rows.
export async function getPageThread(
  siteId: string,
  pageId: string,
  days: 7 | 30 | 90,
  db: Db = getBusinessDb(),
): Promise<PageThreadDetail> {
  const [site] = await db.select({ name: sites.name }).from(sites).where(eq(sites.id, siteId)).limit(1)
  if (!site) throw new HttpError(404, 'SITE_NOT_FOUND', 'Site was not found')

  const [page] = await listModerationPages(siteId, { pageId }, db)
  if (!page) throw new HttpError(404, 'PAGE_NOT_FOUND', 'Page was not found')

  const now = new Date()
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)))

  const [totalRows, voteRows, topAuthors, moderationActions] = await Promise.all([
    db
      .select({
        comments: count(comments.id),
        visible: sql<number>`count(*) filter (where ${comments.status} = 'visible')`,
        hidden: sql<number>`count(*) filter (where ${comments.status} = 'hidden')`,
        deleted: sql<number>`count(*) filter (where ${comments.status} = 'deleted')`,
        replies: sql<number>`count(*) filter (where ${comments.parentId} is not null)`,
        pinned: sql<number>`count(*) filter (where ${comments.pinnedAt} is not null)`,
        // A guest has no user id, so the author name identifies them.
        participants: sql<number>`count(distinct coalesce(${comments.userId}, 'guest:' || ${comments.authorName}))`,
        firstAt: sql<Date | null>`min(${comments.createdAt})`,
      })
      .from(comments)
      .where(eq(comments.pageId, pageId)),
    db
      .select({
        votesUp: sql<number>`count(*) filter (where ${votes.value} = 1)`,
        votesDown: sql<number>`count(*) filter (where ${votes.value} = -1)`,
      })
      .from(votes)
      .innerJoin(comments, eq(votes.commentId, comments.id))
      .where(eq(comments.pageId, pageId)),
    db
      .select({ authorName: comments.authorName, total: count(comments.id) })
      .from(comments)
      .where(
        and(
          eq(comments.pageId, pageId),
          inArray(comments.status, ['visible', 'hidden']),
          gte(comments.createdAt, windowStart),
        ),
      )
      .groupBy(comments.authorName)
      .orderBy(desc(count(comments.id)))
      .limit(5),
    // Page events plus the events of the thread's own comments. User blocks
    // are not page-attributable, so they never appear here.
    db
      .select({ action: moderationEvents.action, count: count() })
      .from(moderationEvents)
      .where(
        and(
          eq(moderationEvents.siteId, siteId),
          gte(moderationEvents.occurredAt, windowStart),
          sql`(${moderationEvents.targetType} = 'page' and ${moderationEvents.targetId} = ${pageId}) or (${moderationEvents.targetType} = 'comment' and ${moderationEvents.targetId} in (select ${comments.id}::text from ${comments} where ${comments.pageId} = ${pageId}))`,
        ),
      )
      .groupBy(moderationEvents.action)
      .orderBy(desc(count())),
  ])

  // The same day spine as the site stats, narrowed to this page.
  const seriesRows = await db.execute<{
    day: string
    comments: number
    visible: number
    hidden: number
    votesUp: number
    votesDown: number
  }>(sql`
    with days as (
      select generate_series(
        date_trunc('day', now() - ((${days} - 1) * interval '1 day')),
        date_trunc('day', now()),
        interval '1 day'
      ) as day
    ),
    comment_days as (
      select date_trunc('day', c.created_at) as day,
        count(*)::int as comments,
        count(*) filter (where c.status = 'visible')::int as visible,
        count(*) filter (where c.status = 'hidden')::int as hidden
      from comments c
      where c.page_id = ${pageId} and c.created_at >= (select min(day) from days)
      group by 1
    ),
    vote_days as (
      select date_trunc('day', v.created_at) as day,
        count(*) filter (where v.value = 1)::int as up,
        count(*) filter (where v.value = -1)::int as down
      from votes v
      join comments c on c.id = v.comment_id
      where c.page_id = ${pageId} and v.created_at >= (select min(day) from days)
      group by 1
    )
    select to_char(days.day, 'YYYY-MM-DD') as day,
      coalesce(comment_days.comments, 0)::int as comments,
      coalesce(comment_days.visible, 0)::int as visible,
      coalesce(comment_days.hidden, 0)::int as hidden,
      coalesce(vote_days.up, 0)::int as "votesUp",
      coalesce(vote_days.down, 0)::int as "votesDown"
    from days
    left join comment_days on comment_days.day = days.day
    left join vote_days on vote_days.day = days.day
    order by days.day
  `)

  const series = seriesRows.map((row) => ({
    day: row.day,
    comments: Number(row.comments),
    visible: Number(row.visible),
    hidden: Number(row.hidden),
    votesUp: Number(row.votesUp),
    votesDown: Number(row.votesDown),
  }))

  const totals = totalRows[0]
  return {
    siteName: site.name,
    page,
    stats: {
      totals: {
        comments: Number(totals?.comments ?? 0),
        visible: Number(totals?.visible ?? 0),
        hidden: Number(totals?.hidden ?? 0),
        deleted: Number(totals?.deleted ?? 0),
        votesUp: Number(voteRows[0]?.votesUp ?? 0),
        votesDown: Number(voteRows[0]?.votesDown ?? 0),
        replies: Number(totals?.replies ?? 0),
        pinned: Number(totals?.pinned ?? 0),
        participants: Number(totals?.participants ?? 0),
      },
      window: {
        days,
        start: series[0]?.day ?? windowStart.toISOString().slice(0, 10),
        comments: series.reduce((sum, row) => sum + row.comments, 0),
        votesUp: series.reduce((sum, row) => sum + row.votesUp, 0),
        votesDown: series.reduce((sum, row) => sum + row.votesDown, 0),
      },
      series,
      topAuthors: topAuthors.map((row) => ({
        authorName: row.authorName,
        total: Number(row.total),
      })),
      moderationActions: moderationActions.map((row) => ({
        action: row.action,
        count: Number(row.count),
      })),
      firstAt: totals?.firstAt ?? null,
    },
  }
}

export type SitePage = {
  id: string
  canonicalUrl: string
  pageKey: string | null
  title: string | null
  isLocked: boolean
}

// Publisher entry point (POST /api/admin/pages): registering the same thread
// twice is idempotent — same slug + URL, or the same URL, returns the same
// thread id — and conflicts keep the comment path's PAGE_KEY_MISMATCH codes.
export async function upsertPage(
  siteKey: string,
  input: { url: string; pageKey?: string; title?: string },
  db: Db = getBusinessDb(),
): Promise<SitePage> {
  const siteId = await getSiteId(siteKey, db)
  const pageUrl = normalizePageUrl(input.url)
  // Pages belong to the site's own origins: the dashboard shows the allowed
  // origin read-only and the comment API only accepts callers from them.
  const allowed = await db
    .select({ origin: siteOrigins.origin })
    .from(siteOrigins)
    .where(eq(siteOrigins.siteId, siteId))
  const urlOrigin = new URL(pageUrl).origin
  if (!allowed.some((row) => row.origin === urlOrigin)) {
    const list = allowed.map((row) => row.origin).join(', ') || 'none configured'
    throw new HttpError(400, 'PAGE_ORIGIN_NOT_ALLOWED', `Page URL must use an allowed site origin: ${list}`)
  }
  const pageKey = input.pageKey === undefined ? undefined : normalizePageKey(input.pageKey)
  const pageId = await db.transaction((tx) =>
    resolvePage(tx, { siteId, pageUrl, pageKey, ...(input.title === undefined ? {} : { title: input.title }) }),
  )
  const [page] = await db
    .select({
      id: pages.id,
      canonicalUrl: pages.canonicalUrl,
      pageKey: pages.pageKey,
      title: pages.title,
      isLocked: pages.isLocked,
    })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.id, pageId)))
    .limit(1)
  if (!page) throw new HttpError(500, 'PAGE_UNAVAILABLE', 'Page is unavailable')
  return page
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
    eq(pages.siteId, siteId),
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
        userBlocked: sql<boolean>`exists (select 1 from ${userBlocks} where ${userBlocks.siteId} = ${pages.siteId} and ${userBlocks.userId} = ${comments.userId})`,
        authorName: comments.authorName,
        bodyMarkdown: comments.bodyMarkdown,
        status: comments.status,
        pinnedAt: comments.pinnedAt,
        createdAt: comments.createdAt,
        score: sql<number>`(select coalesce(sum(${votes.value}), 0) from ${votes} where ${votes.commentId} = ${comments.id})`,
        viewerVote,
        authorRole: siteMemberships.role,
      })
      .from(comments)
      .innerJoin(pages, eq(comments.pageId, pages.id))
      .leftJoin(
        siteMemberships,
        and(eq(comments.userId, siteMemberships.userId), eq(pages.siteId, siteMemberships.siteId)),
      )
      .where(filter)
      .orderBy(
        ...(newestFirst ? [desc(comments.createdAt), desc(comments.id)] : [asc(comments.createdAt), asc(comments.id)]),
      )
      .limit(options.limit)
      .offset(options.offset),
    db.select({ total: count() }).from(comments).innerJoin(pages, eq(comments.pageId, pages.id)).where(filter),
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
  role: MembershipRole | null
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
      .innerJoin(pages, eq(comments.pageId, pages.id))
      .where(and(eq(pages.siteId, siteId), isNotNull(comments.userId)))
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
        role: roleByUser.get(row.id) ?? null,
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
  const filter = and(eq(pages.siteId, siteId), eq(comments.userId, userId))
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
    db.select({ total: count() }).from(comments).innerJoin(pages, eq(comments.pageId, pages.id)).where(filter),
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
    .select({ id: sites.id, key: sites.key, name: sites.name, role: siteMemberships.role })
    .from(siteMemberships)
    .innerJoin(sites, eq(siteMemberships.siteId, sites.id))
    .where(eq(siteMemberships.userId, userId))
    .orderBy(asc(sites.name))
  return attachOrigins(db, rows)
}

export async function setCommentStatus(
  siteId: string,
  actorUserId: string,
  commentId: string,
  action: 'hide' | 'restore' | 'delete' | 'pin' | 'unpin',
  db: Db = getBusinessDb(),
) {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: comments.id, pageId: comments.pageId })
      .from(comments)
      .innerJoin(pages, eq(comments.pageId, pages.id))
      .where(and(eq(comments.id, commentId), eq(pages.siteId, siteId)))
      .limit(1)
    if (!target) throw new HttpError(404, 'COMMENT_NOT_FOUND', 'Comment was not found')

    const status =
      action === 'hide' ? 'hidden' : action === 'restore' ? 'visible' : action === 'delete' ? 'deleted' : undefined
    const [comment] = await tx
      .update(comments)
      .set({
        status,
        deletedAt: action === 'delete' ? new Date() : action === 'restore' ? null : undefined,
        pinnedAt: action === 'pin' ? new Date() : action === 'unpin' ? null : undefined,
        pinnedByUserId: action === 'pin' ? actorUserId : action === 'unpin' ? null : undefined,
        updatedAt: new Date(),
      })
      .where(eq(comments.id, commentId))
      .returning()
    const eventType: CommentEventType =
      action === 'pin' || action === 'unpin'
        ? 'comment.pinned'
        : action === 'hide'
          ? 'comment.hidden'
          : action === 'restore'
            ? 'comment.restored'
            : 'comment.deleted'
    await tx.insert(moderationEvents).values({
      siteId,
      actorUserId,
      action,
      targetType: 'comment',
      targetId: commentId,
    })
    await enqueuePluginEvent(tx, { siteId, type: eventType, aggregateId: commentId, payload: { commentId, action } })
    return withoutEditKeyHash(comment)
  })
}

export async function setPageLocked(
  siteId: string,
  actorUserId: string,
  pageId: string,
  locked: boolean,
  db: Db = getBusinessDb(),
) {
  return db.transaction(async (tx) => {
    const [page] = await tx
      .select({ id: pages.id, canonicalUrl: pages.canonicalUrl })
      .from(pages)
      .where(and(eq(pages.siteId, siteId), eq(pages.id, pageId)))
      .limit(1)
    if (!page) throw new HttpError(404, 'PAGE_NOT_FOUND', 'Page was not found')
    await tx
      .update(pages)
      .set({
        isLocked: locked,
        lockedAt: locked ? new Date() : null,
        lockedByUserId: locked ? actorUserId : null,
        updatedAt: new Date(),
      })
      .where(eq(pages.id, page.id))
    await tx.insert(moderationEvents).values({
      siteId,
      actorUserId,
      action: locked ? 'page.lock' : 'page.unlock',
      targetType: 'page',
      targetId: page.id,
    })
    await enqueuePluginEvent(tx, {
      siteId,
      type: locked ? 'page.locked' : 'page.unlocked',
      aggregateId: page.id,
      payload: { pageId: page.id },
    })
    return { id: page.id, canonicalUrl: page.canonicalUrl, isLocked: locked }
  })
}

export async function setUserBlocked(
  siteId: string,
  actorUserId: string,
  userId: string,
  blocked: boolean,
  options: { expiresAt?: Date | null; reason?: string } = {},
  db: Db = getBusinessDb(),
) {
  return db.transaction(async (tx) => {
    if (blocked) {
      await tx
        .insert(userBlocks)
        .values({
          siteId,
          userId,
          createdByUserId: actorUserId,
          expiresAt: options.expiresAt ?? null,
          reason: options.reason ?? null,
        })
        .onConflictDoUpdate({
          target: [userBlocks.siteId, userBlocks.userId],
          set: {
            createdByUserId: actorUserId,
            expiresAt: options.expiresAt ?? null,
            reason: options.reason ?? null,
            createdAt: new Date(),
          },
        })
    } else {
      await tx.delete(userBlocks).where(and(eq(userBlocks.siteId, siteId), eq(userBlocks.userId, userId)))
    }
    await tx.insert(moderationEvents).values({
      siteId,
      actorUserId,
      action: blocked ? 'user.block' : 'user.unblock',
      targetType: 'user',
      targetId: userId,
      reason: options.reason ?? null,
    })
    await enqueuePluginEvent(tx, {
      siteId,
      type: blocked ? 'user.blocked' : 'user.unblocked',
      aggregateId: userId,
      payload: { userId },
    })
  })
}

async function enqueuePluginEvent(
  tx: Parameters<Parameters<Db['transaction']>[0]>[0],
  event: { siteId: string; type: CommentEventType; aggregateId: string; payload: Record<string, unknown> },
) {
  const plugins = subscribedPlugins(event.type, getCommentPlugins())
  if (plugins.length === 0) return
  const [stored] = await tx
    .insert(pluginEvents)
    .values({ siteId: event.siteId, eventType: event.type, aggregateId: event.aggregateId, payload: event.payload })
    .returning({ id: pluginEvents.id })
  await tx.insert(pluginDeliveries).values(plugins.map((plugin) => ({ eventId: stored.id, pluginId: plugin.id })))
}
