import { createFileRoute } from '@tanstack/react-router'
import { resolveSessionPrincipal } from '@/server/auth/resolve'
import { applyCors } from '@/server/http/cors'
import { HttpError } from '@/server/http/errors'
import { parseJsonBody, parseSearchParams, parseWith } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { deleteCommentData, editCommentData } from '@/server/modules/comments/http/comment-handler'
import { commentIdSchema, editBodySchema, siteQuerySchema } from '@/server/modules/comments/http/comment-schemas'
import { resolvePreflightOrigin } from '@/server/modules/comments/http/preflight'
import { requireAllowedOrigin } from '@/server/modules/comments/infrastructure/comment-repository'
import { publishCommentOperation } from '@/server/plugins/comment-plugins'

export const Route = createFileRoute('/api/comments/$commentId')({
  server: {
    handlers: {
      // No API-key support by design: edit/delete act as a user identity,
      // which a shared site key must never impersonate. Edits accept either a
      // session or the edit key issued to the guest who created the comment.
      PATCH: async ({ request, params }) => {
        let responseOrigin: string | null = null
        const response = await withContext(async () => {
          const body = await parseJsonBody(request, editBodySchema)
          responseOrigin = await requireAllowedOrigin(body.site, request.headers.get('origin'))
          const session = request.headers.get('cookie') ? await resolveSessionPrincipal(request) : null
          const userId = session?.userId ?? null
          if (!userId && !body.editKey) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to edit your comments')
          await publishCommentOperation({
            operation: 'comment.edit',
            siteKey: body.site,
            userId,
            request,
          })
          const comment = await editCommentData({
            siteKey: body.site,
            commentId: parseWith(commentIdSchema, params.commentId),
            userId,
            bodyMarkdown: body.bodyMarkdown,
            ...(body.editKey === undefined ? {} : { editKey: body.editKey }),
          })
          return { comment }
        })({ request })
        return applyCors(response, responseOrigin, 'PATCH, DELETE, OPTIONS')
      },
      DELETE: async ({ request, params }) => {
        let responseOrigin: string | null = null
        const response = await withContext(async () => {
          const { site } = parseSearchParams(request.url, siteQuerySchema)
          responseOrigin = await requireAllowedOrigin(site, request.headers.get('origin'))
          const session = await resolveSessionPrincipal(request)
          if (!session) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to delete your comments')
          await publishCommentOperation({
            operation: 'comment.delete',
            siteKey: site,
            userId: session.userId,
            request,
          })
          const comment = await deleteCommentData({
            siteKey: site,
            commentId: parseWith(commentIdSchema, params.commentId),
            userId: session.userId,
          })
          return { comment }
        })({ request })
        return applyCors(response, responseOrigin, 'PATCH, DELETE, OPTIONS')
      },
      OPTIONS: async ({ request }) => {
        let responseOrigin: string | null = null
        const response = await withContext(async () => {
          responseOrigin = await resolvePreflightOrigin(request)
          return new Response(null, { status: 204 })
        })({ request })
        return applyCors(response, responseOrigin, 'PATCH, DELETE, OPTIONS')
      },
    },
  },
})
