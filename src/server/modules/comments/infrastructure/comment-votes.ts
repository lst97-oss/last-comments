import { and, eq, sql } from 'drizzle-orm'
import { getBusinessDb } from '@/server/db/business-sql'
import { votes } from '@/server/db/schema'
import { enqueuePluginEvent } from '@/server/modules/comments/infrastructure/comment-outbox'
import { assertCanActOnComment, VOTE_ACT } from '@/server/modules/comments/infrastructure/comment-targets'
import type {
  CommentVoteSummary,
  Db,
  Transaction,
  VoteValue,
} from '@/server/modules/comments/infrastructure/comment-types'

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
    const target = await assertCanActOnComment(tx, siteKey, commentId, userId, VOTE_ACT)
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
    const target = await assertCanActOnComment(tx, siteKey, commentId, userId, VOTE_ACT)
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
