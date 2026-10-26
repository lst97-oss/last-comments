import { and, eq, isNull } from 'drizzle-orm'
import { resolveBodyLimit } from '@/lib/comment-schema'
import { getBusinessDb } from '@/server/db/business-sql'
import { comments, pages, sites } from '@/server/db/schema'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { getSiteRole, type MembershipRole } from '@/server/http/route-guards'
import type { CommentCreationContext, CreateCommentData } from '@/server/modules/comments/application/create-comment'
import { normalizePageKey, normalizePageUrl } from '@/server/modules/comments/domain/comment'
import {
  createEditKey,
  hashEditKey,
  matchesEditKey,
  withoutEditKeyHash,
} from '@/server/modules/comments/infrastructure/comment-keys'
import { enqueuePluginEvent } from '@/server/modules/comments/infrastructure/comment-outbox'
import { resolvePage } from '@/server/modules/comments/infrastructure/comment-pages'
import {
  assertCommenterAllowed,
  assertWithinBodyLimit,
  getSiteLimits,
} from '@/server/modules/comments/infrastructure/comment-sites'
import type { Db, Transaction } from '@/server/modules/comments/infrastructure/comment-types'
import { EMPTY_SCREENING, getCommentEditSettings, type ScreenVerdict } from '@/server/plugins/comment-plugins'

export async function prepareCommentCreation(
  data: CreateCommentData,
  db: Db = getBusinessDb(),
): Promise<CommentCreationContext> {
  const pageUrl = normalizePageUrl(data.pageUrl)
  const pageKey = data.pageKey === undefined ? undefined : normalizePageKey(data.pageKey)

  const site = await getSiteLimits(data.siteKey, db)
  assertWithinBodyLimit(data.bodyMarkdown, site.bodyLimit)
  return { siteId: site.id, pageUrl, pageKey }
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
    if (!page)
      throw new HttpError(
        ErrorCode.PAGE_UNAVAILABLE.status,
        ErrorCode.PAGE_UNAVAILABLE.code,
        'Page could not be created',
      )
    if (page.isLocked)
      throw new HttpError(
        ErrorCode.PAGE_LOCKED.status,
        ErrorCode.PAGE_LOCKED.code,
        'Comments are disabled for this page',
      )

    if (data.parentId) {
      const [parent] = await tx
        .select({ id: comments.id })
        .from(comments)
        .where(and(eq(comments.id, data.parentId), eq(comments.pageId, page.id), eq(comments.status, 'visible')))
        .limit(1)
      if (!parent)
        throw new HttpError(
          ErrorCode.PARENT_NOT_FOUND.status,
          ErrorCode.PARENT_NOT_FOUND.code,
          'Reply target was not found',
        )
    }

    const editKey = data.userId ? null : createEditKey()
    const [comment] = await tx
      .insert(comments)
      .values({
        siteId,
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

    const authorRole = await getSiteRole(siteId, data.userId)
    const safeComment = { ...withoutEditKeyHash(comment), authorRole }
    // The plaintext key is returned exactly once; only its hash is stored.
    return editKey ? { ...safeComment, editKey } : safeComment
  })
}

// The comment's own site_id is the tenancy check: the site key must name the same site.
async function findOwnedComment(tx: Transaction, siteKey: string, commentId: string, userId: string) {
  const [comment] = await tx
    .select({
      id: comments.id,
      pageId: comments.pageId,
      siteId: comments.siteId,
      bodyLimit: sites.bodyLimit,
      status: comments.status,
      pageLocked: pages.isLocked,
      createdAt: comments.createdAt,
      editKeyHash: comments.editKeyHash,
    })
    .from(comments)
    .innerJoin(sites, eq(comments.siteId, sites.id))
    .innerJoin(pages, eq(comments.pageId, pages.id))
    .where(and(eq(sites.key, siteKey), eq(comments.id, commentId), eq(comments.userId, userId)))
    .limit(1)
  if (!comment)
    throw new HttpError(ErrorCode.COMMENT_NOT_FOUND.status, ErrorCode.COMMENT_NOT_FOUND.code, 'Comment was not found')
  return comment
}

async function findGuestComment(tx: Transaction, siteKey: string, commentId: string, editKey: string) {
  const [comment] = await tx
    .select({
      id: comments.id,
      pageId: comments.pageId,
      siteId: comments.siteId,
      bodyLimit: sites.bodyLimit,
      status: comments.status,
      pageLocked: pages.isLocked,
      createdAt: comments.createdAt,
      editKeyHash: comments.editKeyHash,
    })
    .from(comments)
    .innerJoin(sites, eq(comments.siteId, sites.id))
    .innerJoin(pages, eq(comments.pageId, pages.id))
    .where(and(eq(sites.key, siteKey), eq(comments.id, commentId), isNull(comments.userId)))
    .limit(1)
  // A wrong key is indistinguishable from a missing comment: callers must not
  // be able to probe which guest comments exist.
  if (!comment?.editKeyHash || !(await matchesEditKey(editKey, comment.editKeyHash))) {
    throw new HttpError(ErrorCode.COMMENT_NOT_FOUND.status, ErrorCode.COMMENT_NOT_FOUND.code, 'Comment was not found')
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
    if (target.status !== 'visible')
      throw new HttpError(ErrorCode.COMMENT_NOT_FOUND.status, ErrorCode.COMMENT_NOT_FOUND.code, 'Comment was not found')
    if (!data.userId) {
      const anonWindowMinutes = data.anonWindowMinutes ?? getCommentEditSettings().anonWindowMinutes
      if (anonWindowMinutes > 0 && Date.now() - target.createdAt.getTime() > anonWindowMinutes * 60_000)
        throw new HttpError(
          ErrorCode.EDIT_WINDOW_EXPIRED.status,
          ErrorCode.EDIT_WINDOW_EXPIRED.code,
          'The edit window for this comment has expired',
        )
    }
    if (target.pageLocked)
      throw new HttpError(
        ErrorCode.PAGE_LOCKED.status,
        ErrorCode.PAGE_LOCKED.code,
        'Comments are disabled for this page',
      )
    assertWithinBodyLimit(data.bodyMarkdown.trim(), resolveBodyLimit(target.bodyLimit))

    if (data.userId) await assertCommenterAllowed(tx, target.siteId, data.userId, 'You cannot comment on this site')

    const hideOnEdit = screening.decision === 'hide'
    const [comment] = await tx
      .update(comments)
      .set({
        bodyMarkdown: data.bodyMarkdown.trim(),
        editedAt: new Date(),
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
    if (!comment)
      throw new HttpError(ErrorCode.COMMENT_NOT_FOUND.status, ErrorCode.COMMENT_NOT_FOUND.code, 'Comment was not found')

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
    const authorRole = await getSiteRole(target.siteId, data.userId)
    return { ...withoutEditKeyHash(comment), authorRole }
  })
}

// Signed-in owners delete with their session; guests with the edit key from create time.
// A guest delete has no time window: retracting a comment should not expire.
export async function deleteOwnComment(
  data: { siteKey: string; commentId: string; userId: string | null; editKey?: string },
  db: Db = getBusinessDb(),
) {
  return db.transaction(async (tx) => {
    const target = data.userId
      ? await findOwnedComment(tx, data.siteKey, data.commentId, data.userId)
      : await findGuestComment(tx, data.siteKey, data.commentId, data.editKey ?? '')
    // Only a visible comment is the author's to retract. A hidden one is under moderator review,
    // and deleting it here would let a later restore republish the body.
    if (target.status !== 'visible')
      throw new HttpError(ErrorCode.COMMENT_NOT_FOUND.status, ErrorCode.COMMENT_NOT_FOUND.code, 'Comment was not found')

    const [comment] = await tx
      .update(comments)
      .set({ status: 'deleted', deletedAt: new Date() })
      .where(
        and(
          eq(comments.id, data.commentId),
          eq(comments.pageId, target.pageId),
          // The guest key only ever reaches guest rows, never a signed-in author's.
          data.userId ? eq(comments.userId, data.userId) : isNull(comments.userId),
          eq(comments.status, 'visible'),
        ),
      )
      .returning()
    if (!comment)
      throw new HttpError(ErrorCode.COMMENT_NOT_FOUND.status, ErrorCode.COMMENT_NOT_FOUND.code, 'Comment was not found')

    await enqueuePluginEvent(tx, {
      siteId: target.siteId,
      type: 'comment.deleted',
      aggregateId: comment.id,
      payload: { commentId: comment.id, action: 'delete', userId: data.userId },
    })
    return withoutEditKeyHash(comment)
  })
}
