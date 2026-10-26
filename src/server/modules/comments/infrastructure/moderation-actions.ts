import { and, count, eq, sql } from 'drizzle-orm'
import { getBusinessDb } from '@/server/db/business-sql'
import { comments, moderationEvents, pages, userBlocks, votes } from '@/server/db/schema'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { normalizePageKey, normalizePageUrl } from '@/server/modules/comments/domain/comment'
import { withoutEditKeyHash } from '@/server/modules/comments/infrastructure/comment-keys'
import { enqueuePluginEvent } from '@/server/modules/comments/infrastructure/comment-outbox'
import type { Db } from '@/server/modules/comments/infrastructure/comment-types'
import type { CommentEventType } from '@/server/plugins/comment-plugins'

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
      .where(and(eq(comments.id, commentId), eq(comments.siteId, siteId)))
      .limit(1)
    if (!target)
      throw new HttpError(ErrorCode.COMMENT_NOT_FOUND.status, ErrorCode.COMMENT_NOT_FOUND.code, 'Comment was not found')

    const status =
      action === 'hide' ? 'hidden' : action === 'restore' ? 'visible' : action === 'delete' ? 'deleted' : undefined
    const [comment] = await tx
      .update(comments)
      .set({
        status,
        // deleted_at is set exactly while the status is 'deleted' (the schema's CHECK), so a status
        // change moves it with the status; pin and unpin leave both alone.
        deletedAt: status === undefined ? undefined : status === 'deleted' ? new Date() : null,
        pinnedAt: action === 'pin' ? new Date() : action === 'unpin' ? null : undefined,
        pinnedByUserId: action === 'pin' ? actorUserId : action === 'unpin' ? null : undefined,
      })
      .where(and(eq(comments.id, commentId), eq(comments.siteId, siteId)))
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
    if (!page) throw new HttpError(ErrorCode.PAGE_NOT_FOUND.status, ErrorCode.PAGE_NOT_FOUND.code, 'Page was not found')
    await tx
      .update(pages)
      .set({
        isLocked: locked,
        lockedAt: locked ? new Date() : null,
        lockedByUserId: locked ? actorUserId : null,
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

// Permanent. The page, its comments, their replies and their votes go in one
// transaction (the foreign keys cascade). Site-level state (blocks, verifications,
// memberships, origins) stays. The audit row keeps the URL, so the record reads
// correctly after the page is gone. The counts are taken first, for the response.
export async function deletePage(
  siteId: string,
  actorUserId: string,
  target: { pageId: string } | { pageKey: string } | { url: string },
  db: Db = getBusinessDb(),
): Promise<{ deleted: true; comments: number; replies: number; votes: number }> {
  return db.transaction(async (tx) => {
    const match =
      'pageId' in target
        ? eq(pages.id, target.pageId)
        : 'pageKey' in target
          ? eq(pages.pageKey, normalizePageKey(target.pageKey))
          : eq(pages.canonicalUrl, normalizePageUrl(target.url))
    const [page] = await tx
      .select({ id: pages.id, canonicalUrl: pages.canonicalUrl })
      .from(pages)
      .where(and(eq(pages.siteId, siteId), match))
      .limit(1)
    if (!page) throw new HttpError(ErrorCode.PAGE_NOT_FOUND.status, ErrorCode.PAGE_NOT_FOUND.code, 'Page was not found')

    const [[totals], [voteTotals]] = await Promise.all([
      tx
        .select({
          comments: count(comments.id),
          replies: sql<number>`count(*) filter (where ${comments.parentId} is not null)`,
        })
        .from(comments)
        .where(eq(comments.pageId, page.id)),
      tx
        .select({ votes: count() })
        .from(votes)
        .innerJoin(comments, eq(votes.commentId, comments.id))
        .where(eq(comments.pageId, page.id)),
    ])

    await tx.delete(pages).where(and(eq(pages.siteId, siteId), eq(pages.id, page.id)))
    await tx.insert(moderationEvents).values({
      siteId,
      actorUserId,
      action: 'page.delete',
      targetType: 'page',
      targetId: page.id,
      reason: page.canonicalUrl,
    })
    await enqueuePluginEvent(tx, {
      siteId,
      type: 'page.deleted',
      aggregateId: page.id,
      payload: { pageId: page.id, canonicalUrl: page.canonicalUrl },
    })
    return {
      deleted: true,
      comments: Number(totals?.comments ?? 0),
      replies: Number(totals?.replies ?? 0),
      votes: Number(voteTotals?.votes ?? 0),
    }
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
