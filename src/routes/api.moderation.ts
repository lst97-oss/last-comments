import { createFileRoute } from '@tanstack/react-router'
import { resolveSessionPrincipal } from '@/server/auth/resolve'
import { HttpError } from '@/server/http/errors'
import { assertSameOrigin } from '@/server/http/route-guards'
import { parseJsonBody, parseSearchParams } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { createModerationCommentData, editModerationCommentData } from '@/server/modules/comments/http/comment-handler'
import { actionSchema, listQuerySchema } from '@/server/modules/comments/http/comment-schemas'
import { requireInstanceAdmin, requireSiteModerator } from '@/server/modules/comments/http/moderation-guards'
import {
  castCommentVote,
  clearCommentVote,
  getPageCanonicalUrl,
  listModerationComments,
  listModerationPages,
  listModerationSites,
  setCommentStatus,
  setPageLocked,
  setUserBlocked,
} from '@/server/modules/comments/infrastructure/comment-repository'

// Moderation stays session-only: API keys are for sites and site keys, never
// comment operations. Moderation happens in the admin dashboard.

export const Route = createFileRoute('/api/moderation')({
  server: {
    handlers: {
      GET: ({ request }) =>
        withContext(async () => {
          const { site, pageId, status, sort, limit, offset } = parseSearchParams(request.url, listQuerySchema)
          const { userId } = await requireInstanceAdmin(request)
          if (!site) return { sites: await listModerationSites(userId), isInstanceAdmin: true }
          const moderator = await requireSiteModerator(request, site)
          const result = await listModerationComments(moderator.siteId, {
            pageId,
            status,
            sort,
            viewerUserId: moderator.userId,
            limit,
            offset,
          })
          return {
            sites: await listModerationSites(userId),
            pages: await listModerationPages(moderator.siteId),
            comments: result.comments,
            total: result.total,
            isInstanceAdmin: true,
          }
        })({ request }),
      POST: ({ request }) =>
        withContext(async () => {
          assertSameOrigin(request, 'Moderation requests must use the application origin')
          const body = await parseJsonBody(request, actionSchema)
          const moderator = await requireSiteModerator(request, body.site)
          if (body.target === 'comment-create') {
            // Moderation posts skip the public origin, guest-name and
            // rate-limit gates; the session is the verification.
            const pageUrl = await getPageCanonicalUrl(moderator.siteId, body.pageId)
            if (!pageUrl) throw new HttpError(404, 'PAGE_NOT_FOUND', 'Page was not found')
            const session = await resolveSessionPrincipal(request)
            const anonymous = body.anonymous === true
            const comment = await createModerationCommentData({
              siteKey: body.site,
              pageUrl,
              parentId: body.parentId,
              userId: anonymous ? null : moderator.userId,
              authorName: anonymous ? (body.authorName ?? 'Anonymous') : (session?.displayName ?? 'Moderator'),
              bodyMarkdown: body.bodyMarkdown,
            })
            // The dashboard widget renders the created row directly, so it
            // takes the same shape the public create route returns.
            return { comment }
          }
          if (body.target === 'comment-edit') {
            // Moderators editing their own comment: same own-comment rule as the
            // public PATCH, but keyed to the session rather than a site origin.
            // Trusted like the other moderation writes: never auto-hidden.
            return {
              comment: await editModerationCommentData({
                siteKey: body.site,
                commentId: body.commentId,
                userId: moderator.userId,
                bodyMarkdown: body.bodyMarkdown,
              }),
            }
          }
          if (body.target === 'vote') {
            // Voting from the dashboard: same rules as the public vote route
            // (visible comment, unlocked page, unblocked voter), but keyed to
            // the session instead of a site origin.
            const vote =
              body.value === null
                ? await clearCommentVote(body.site, body.commentId, moderator.userId)
                : await castCommentVote(body.site, body.commentId, moderator.userId, body.value)
            return { vote }
          }
          if (body.target === 'page') {
            return { page: await setPageLocked(moderator.siteId, moderator.userId, body.pageId, body.locked) }
          }
          if (body.target === 'user') {
            await setUserBlocked(moderator.siteId, moderator.userId, body.userId, body.blocked)
            return { userId: body.userId, blocked: body.blocked }
          }
          return {
            comment: await setCommentStatus(moderator.siteId, moderator.userId, body.commentId, body.action),
          }
        })({ request }),
    },
  },
})
