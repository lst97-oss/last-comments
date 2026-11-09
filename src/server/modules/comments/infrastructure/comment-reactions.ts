import { and, eq, inArray, sql } from 'drizzle-orm'
import { getBusinessDb } from '@/server/db/business-sql'
import { commentReactions, pageReactions, pages, sites } from '@/server/db/schema'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { normalizePageKey, normalizePageUrl } from '@/server/modules/comments/domain/comment'
import {
  type ReactionEmoji,
  type ReactionRow,
  type ReactionSummary,
  toReactionSummaries,
} from '@/server/modules/comments/domain/reactions'
import { SWITCH_COPY } from '@/server/modules/comments/domain/switch-copy'
import { enqueuePluginEvent } from '@/server/modules/comments/infrastructure/comment-outbox'
import { pageMatch, resolvePage } from '@/server/modules/comments/infrastructure/comment-pages'
import { assertCommenterAllowed } from '@/server/modules/comments/infrastructure/comment-sites'
import { assertCanActOnComment, REACTION_ACT } from '@/server/modules/comments/infrastructure/comment-targets'
import type { Db, Transaction } from '@/server/modules/comments/infrastructure/comment-types'

type Executor = Db | Transaction

// A page is named by its URL, or by its slug when it has one, as the comment list names it.
export type PageRef = { pageUrl: string; pageKey?: string }

// Reactions for many comments in one query, grouped by comment and emoji. Served by the primary key's
// leading column, so a page of comments costs one read instead of a subquery per row. A null viewer
// (a guest) matches nothing, so every viewerReacted is false.
export async function listCommentReactions(
  commentIds: string[],
  viewerUserId: string | null,
  db: Executor = getBusinessDb(),
): Promise<Map<string, ReactionSummary[]>> {
  if (commentIds.length === 0) return new Map()
  const rows = await db
    .select({
      commentId: commentReactions.commentId,
      emoji: commentReactions.emoji,
      count: sql<number>`count(*)::int`,
      viewerReacted: sql<boolean>`coalesce(bool_or(${commentReactions.userId} = ${viewerUserId}), false)`,
    })
    .from(commentReactions)
    .where(inArray(commentReactions.commentId, commentIds))
    .groupBy(commentReactions.commentId, commentReactions.emoji)

  const byComment = new Map<string, ReactionRow[]>()
  for (const row of rows) byComment.set(row.commentId, [...(byComment.get(row.commentId) ?? []), row])
  return new Map([...byComment].map(([commentId, group]) => [commentId, toReactionSummaries(group)]))
}

async function commentSummary(tx: Transaction, commentId: string, userId: string): Promise<ReactionSummary[]> {
  return (await listCommentReactions([commentId], userId, tx)).get(commentId) ?? []
}

export async function addCommentReaction(
  siteKey: string,
  commentId: string,
  userId: string,
  emoji: ReactionEmoji,
  db: Db = getBusinessDb(),
): Promise<ReactionSummary[]> {
  return db.transaction(async (tx) => {
    await assertCanActOnComment(tx, siteKey, commentId, userId, REACTION_ACT)
    await tx.insert(commentReactions).values({ commentId, userId, emoji }).onConflictDoNothing()
    return commentSummary(tx, commentId, userId)
  })
}

export async function removeCommentReaction(
  siteKey: string,
  commentId: string,
  userId: string,
  emoji: ReactionEmoji,
  db: Db = getBusinessDb(),
): Promise<ReactionSummary[]> {
  return db.transaction(async (tx) => {
    await assertCanActOnComment(tx, siteKey, commentId, userId, REACTION_ACT)
    await tx
      .delete(commentReactions)
      .where(
        and(
          eq(commentReactions.commentId, commentId),
          eq(commentReactions.userId, userId),
          eq(commentReactions.emoji, emoji),
        ),
      )
    return commentSummary(tx, commentId, userId)
  })
}

// The thread a page reference names within one site, or null when no thread has that URL or slug yet.
async function findPage(db: Executor, siteKey: string, page: PageRef) {
  const [row] = await db
    .select({ id: pages.id, siteId: pages.siteId, isLocked: pages.isLocked })
    .from(pages)
    .innerJoin(sites, eq(pages.siteId, sites.id))
    .where(and(eq(sites.key, siteKey), pageMatch(page.pageUrl, page.pageKey)))
    .limit(1)
  return row ?? null
}

// Whether the page already has a thread. A reaction that would start one is charged to the thread budget.
export async function hasPageThread(siteKey: string, page: PageRef, db: Db = getBusinessDb()): Promise<boolean> {
  return (await findPage(db, siteKey, page)) !== null
}

async function pageSummary(db: Executor, pageId: string, viewerUserId: string | null): Promise<ReactionSummary[]> {
  const rows = await db
    .select({
      emoji: pageReactions.emoji,
      count: sql<number>`count(*)::int`,
      viewerReacted: sql<boolean>`coalesce(bool_or(${pageReactions.userId} = ${viewerUserId}), false)`,
    })
    .from(pageReactions)
    .where(eq(pageReactions.pageId, pageId))
    .groupBy(pageReactions.emoji)
  return toReactionSummaries(rows)
}

// The page bar's switch, checked before any thread is touched.
async function assertPageReactionsOpen(tx: Transaction, siteKey: string, userId: string): Promise<string> {
  const [site] = await tx
    .select({ id: sites.id, enabled: sites.pageReactionsEnabled })
    .from(sites)
    .where(eq(sites.key, siteKey))
    .limit(1)
  if (!site) throw new HttpError(ErrorCode.SITE_NOT_FOUND.status, ErrorCode.SITE_NOT_FOUND.code, 'Site was not found')
  if (!site.enabled)
    throw new HttpError(
      ErrorCode.FEATURE_DISABLED.status,
      ErrorCode.FEATURE_DISABLED.code,
      SWITCH_COPY.pageReactions.off,
    )
  await assertCommenterAllowed(tx, site.id, userId, SWITCH_COPY.pageReactions.refusal)
  return site.id
}

function assertPageUnlocked(isLocked: boolean): void {
  if (isLocked)
    throw new HttpError(ErrorCode.PAGE_LOCKED.status, ErrorCode.PAGE_LOCKED.code, 'Comments are disabled for this page')
}

export async function addPageReaction(
  siteKey: string,
  page: PageRef,
  userId: string,
  emoji: ReactionEmoji,
  db: Db = getBusinessDb(),
): Promise<ReactionSummary[]> {
  return db.transaction(async (tx) => {
    const siteId = await assertPageReactionsOpen(tx, siteKey, userId)
    // A first reaction starts the thread, as a first comment does. The route charges that to the thread budget.
    const pageId = await resolvePage(tx, {
      siteId,
      pageUrl: normalizePageUrl(page.pageUrl),
      ...(page.pageKey === undefined ? {} : { pageKey: normalizePageKey(page.pageKey) }),
    })
    const [thread] = await tx.select({ isLocked: pages.isLocked }).from(pages).where(eq(pages.id, pageId)).limit(1)
    assertPageUnlocked(thread?.isLocked ?? false)
    // A repeat of the same reaction inserts nothing, so it emits no event: only a new reaction notifies.
    const inserted = await tx
      .insert(pageReactions)
      .values({ pageId, userId, emoji })
      .onConflictDoNothing()
      .returning({ emoji: pageReactions.emoji })
    if (inserted.length > 0) {
      await enqueuePluginEvent(tx, {
        siteId,
        type: 'page.reacted',
        aggregateId: pageId,
        payload: { pageId, pageUrl: normalizePageUrl(page.pageUrl), userId, emoji },
      })
    }
    return pageSummary(tx, pageId, userId)
  })
}

export async function removePageReaction(
  siteKey: string,
  page: PageRef,
  userId: string,
  emoji: ReactionEmoji,
  db: Db = getBusinessDb(),
): Promise<ReactionSummary[]> {
  return db.transaction(async (tx) => {
    await assertPageReactionsOpen(tx, siteKey, userId)
    const thread = await findPage(tx, siteKey, page)
    if (!thread)
      throw new HttpError(ErrorCode.PAGE_NOT_FOUND.status, ErrorCode.PAGE_NOT_FOUND.code, 'Page was not found')
    assertPageUnlocked(thread.isLocked)
    await tx
      .delete(pageReactions)
      .where(and(eq(pageReactions.pageId, thread.id), eq(pageReactions.userId, userId), eq(pageReactions.emoji, emoji)))
    return pageSummary(tx, thread.id, userId)
  })
}

// A read names no thread that does not exist: an unknown page simply has no reactions.
export async function listPageReactions(
  siteKey: string,
  page: PageRef,
  viewerUserId: string | null,
  db: Db = getBusinessDb(),
): Promise<ReactionSummary[]> {
  const thread = await findPage(db, siteKey, page)
  if (!thread) return []
  return pageSummary(db, thread.id, viewerUserId)
}
