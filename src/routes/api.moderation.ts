import { createFileRoute } from '@tanstack/react-router'
import { resolveSessionPrincipal } from '@/server/auth/resolve'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { assertSameOrigin } from '@/server/http/route-guards'
import { parseJsonBody, parseSearchParams } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { createModerationCommentData, editModerationCommentData } from '@/server/modules/comments/http/comment-handler'
import { actionSchema, listQuerySchema } from '@/server/modules/comments/http/comment-schemas'
import { requireInstanceAdmin, requireSiteAdmin } from '@/server/modules/comments/http/moderation-guards'
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
          const siteAdmin = await requireSiteAdmin(request, site)
          const result = await listModerationComments(siteAdmin.siteId, {
            pageId,
            status,
            sort,
            viewerUserId: siteAdmin.userId,
            limit,
            offset,
          })
          return {
            sites: await listModerationSites(userId),
            pages: await listModerationPages(siteAdmin.siteId),
            comments: result.comments,
            total: result.total,
            isInstanceAdmin: true,
          }
        })({ request }),
      POST: ({ request }) =>
        withContext(async () => {
          assertSameOrigin(request, 'Moderation requests must use the application origin')
          const body = await parseJsonBody(request, actionSchema)
          const siteAdmin = await requireSiteAdmin(request, body.site)
          if (body.target === 'comment-create') {
            // Moderation posts skip the public origin, guest-name and
            // rate-limit gates; the session is the verification.
            const pageUrl = await getPageCanonicalUrl(siteAdmin.siteId, body.pageId)
            if (!pageUrl)
              throw new HttpError(ErrorCode.PAGE_NOT_FOUND.status, ErrorCode.PAGE_NOT_FOUND.code, 'Page was not found')
            const session = await resolveSessionPrincipal(request)
            const anonymous = body.anonymous === true
            const comment = await createModerationCommentData({
              siteKey: body.site,
              pageUrl,
              parentId: body.parentId,
              userId: anonymous ? null : siteAdmin.userId,
              authorName: anonymous ? (body.authorName ?? 'Anonymous') : (session?.displayName ?? 'Moderator'),
              bodyMarkdown: body.bodyMarkdown,
            })
            // The dashboard widget renders the created row directly, so it
            // takes the same shape the public create route returns.
            return { comment }
          }
          if (body.target === 'comment-edit') {
            // Admins editing their own comment: same own-comment rule as the
            // public PATCH, but keyed to the session rather than a site origin.
            // Trusted like the other moderation writes: never auto-hidden.
            return {
              comment: await editModerationCommentData({
                siteKey: body.site,
                commentId: body.commentId,
                userId: siteAdmin.userId,
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
                ? await clearCommentVote(body.site, body.commentId, siteAdmin.userId)
                : await castCommentVote(body.site, body.commentId, siteAdmin.userId, body.value)
            return { vote }
          }
          if (body.target === 'page') {
            return { page: await setPageLocked(siteAdmin.siteId, siteAdmin.userId, body.pageId, body.locked) }
          }
          if (body.target === 'user') {
            await setUserBlocked(siteAdmin.siteId, siteAdmin.userId, body.userId, body.blocked)
            return { userId: body.userId, blocked: body.blocked }
          }
          return {
            comment: await setCommentStatus(siteAdmin.siteId, siteAdmin.userId, body.commentId, body.action),
          }
        })({ request }),
    },
  },
})
