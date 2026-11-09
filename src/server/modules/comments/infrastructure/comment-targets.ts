import { and, eq } from 'drizzle-orm'
import { comments, pages, sites } from '@/server/db/schema'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { SWITCH_COPY } from '@/server/modules/comments/domain/switch-copy'
import { assertCommenterAllowed } from '@/server/modules/comments/infrastructure/comment-sites'
import type { Transaction } from '@/server/modules/comments/infrastructure/comment-types'

// What a signed-in act on a visible comment is refused by: its switch, the refusal text for a blocked viewer.
export type CommentAct = {
  flag: 'votesEnabled' | 'commentReactionsEnabled'
  flagOff: string
  refusal: string
}

export const VOTE_ACT: CommentAct = {
  flag: 'votesEnabled',
  flagOff: SWITCH_COPY.votes.off,
  refusal: SWITCH_COPY.votes.refusal,
}

export const REACTION_ACT: CommentAct = {
  flag: 'commentReactionsEnabled',
  flagOff: SWITCH_COPY.commentReactions.off,
  refusal: SWITCH_COPY.commentReactions.refusal,
}

// The gate every act on a comment passes, in one read: the comment must be visible in this site, its
// switch on, its page unlocked, and the viewer not blocked. Votes and reactions share it, and differ only
// in the switch they name. The switch is checked again here, in the same transaction as the write.
export async function assertCanActOnComment(
  tx: Transaction,
  siteKey: string,
  commentId: string,
  userId: string,
  act: CommentAct,
) {
  const [target] = await tx
    .select({
      siteId: sites.id,
      pageId: comments.pageId,
      status: comments.status,
      pageLocked: pages.isLocked,
      votesEnabled: sites.votesEnabled,
      commentReactionsEnabled: sites.commentReactionsEnabled,
    })
    .from(comments)
    .innerJoin(pages, eq(comments.pageId, pages.id))
    .innerJoin(sites, eq(comments.siteId, sites.id))
    .where(and(eq(sites.key, siteKey), eq(comments.id, commentId)))
    .limit(1)
  if (target?.status !== 'visible') {
    throw new HttpError(ErrorCode.COMMENT_NOT_FOUND.status, ErrorCode.COMMENT_NOT_FOUND.code, 'Comment was not found')
  }
  if (!target[act.flag])
    throw new HttpError(ErrorCode.FEATURE_DISABLED.status, ErrorCode.FEATURE_DISABLED.code, act.flagOff)
  if (target.pageLocked)
    throw new HttpError(ErrorCode.PAGE_LOCKED.status, ErrorCode.PAGE_LOCKED.code, 'Comments are disabled for this page')

  await assertCommenterAllowed(tx, target.siteId, userId, act.refusal)
  return target
}
