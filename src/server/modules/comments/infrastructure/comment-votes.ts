import { and, eq, sql } from 'drizzle-orm'
import { getBusinessDb } from '@/server/db/business-sql'
import { comments, pages, sites, votes } from '@/server/db/schema'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { enqueuePluginEvent } from '@/server/modules/comments/infrastructure/comment-outbox'
import { assertCommenterAllowed } from '@/server/modules/comments/infrastructure/comment-sites'
import type {
  CommentVoteSummary,
  Db,
  Transaction,
  VoteValue,
} from '@/server/modules/comments/infrastructure/comment-types'

async function assertCanVote(tx: Transaction, siteKey: string, commentId: string, userId: string) {
  const [target] = await tx
    .select({
      siteId: sites.id,
      pageId: comments.pageId,
      status: comments.status,
      pageLocked: pages.isLocked,
      votesEnabled: sites.votesEnabled,
    })
    .from(comments)
    .innerJoin(pages, eq(comments.pageId, pages.id))
    .innerJoin(sites, eq(comments.siteId, sites.id))
    .where(and(eq(sites.key, siteKey), eq(comments.id, commentId)))
    .limit(1)
  if (target?.status !== 'visible') {
    throw new HttpError(ErrorCode.COMMENT_NOT_FOUND.status, ErrorCode.COMMENT_NOT_FOUND.code, 'Comment was not found')
  }
  if (!target.votesEnabled)
    throw new HttpError(
      ErrorCode.FEATURE_DISABLED.status,
      ErrorCode.FEATURE_DISABLED.code,
      'Voting is turned off for this site',
    )
  if (target.pageLocked)
    throw new HttpError(ErrorCode.PAGE_LOCKED.status, ErrorCode.PAGE_LOCKED.code, 'Comments are disabled for this page')

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
    const target = await assertCanVote(tx, siteKey, commentId, userId)
    const [previous] = await tx
      .select({ value: votes.value })
      .from(votes)
      .where(and(eq(votes.commentId, commentId), eq(votes.userId, userId)))
      .limit(1)
    await tx
      .insert(votes)
      .values({ commentId, userId, value })
      .onConflictDoUpdate({
        target: [votes.commentId, votes.userId],
        set: { value },
      })
    const summary = await getCommentVoteSummary(tx, commentId, userId)
    // Re-casting the same value changes nothing, so it does not fire an event.
    if (previous?.value !== value) {
      await enqueuePluginEvent(tx, {
        siteId: target.siteId,
        type: 'comment.voted',
        aggregateId: commentId,
        payload: {
          commentId,
          pageId: target.pageId,
          userId,
          value,
          previous: previous?.value ?? null,
          score: summary.score,
        },
      })
    }
    return summary
  })
}

export async function clearCommentVote(
  siteKey: string,
  commentId: string,
  userId: string,
  db: Db = getBusinessDb(),
): Promise<CommentVoteSummary> {
  return db.transaction(async (tx) => {
    const target = await assertCanVote(tx, siteKey, commentId, userId)
    const removed = await tx
      .delete(votes)
      .where(and(eq(votes.commentId, commentId), eq(votes.userId, userId)))
      .returning({ value: votes.value })
    const summary = await getCommentVoteSummary(tx, commentId, userId)
    if (removed.length > 0) {
      await enqueuePluginEvent(tx, {
        siteId: target.siteId,
        type: 'comment.voted',
        aggregateId: commentId,
        payload: {
          commentId,
          pageId: target.pageId,
          userId,
          value: null,
          previous: removed[0]?.value ?? null,
          score: summary.score,
        },
      })
    }
    return summary
  })
}
