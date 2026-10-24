import { createFileRoute } from '@tanstack/react-router'
import { applyCors } from '@/server/http/cors'
import { HttpError } from '@/server/http/errors'
import { parseJsonBody, parseSearchParams, parseWith } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { operationIdentity, resolveCommentCaller } from '@/server/modules/comments/http/comment-caller'
import { deleteCommentData, editCommentData } from '@/server/modules/comments/http/comment-handler'
import { commentIdSchema, editBodySchema, siteQuerySchema } from '@/server/modules/comments/http/comment-schemas'
import { resolvePreflightOrigin } from '@/server/modules/comments/http/preflight'
import { publishCommentOperation } from '@/server/plugins/comment-plugins'

export const Route = createFileRoute('/api/comments/$commentId')({
  server: {
    handlers: {
      // Keys never act as a user: a key call carries no principal, so delete stays
      // session-only. Edits accept a session or the edit key issued to the guest
      // who created the comment; a key may relay that edit key for its visitor.
      PATCH: async ({ request, params }) => {
        let responseOrigin: string | null = null
        const response = await withContext(async () => {
          const body = await parseJsonBody(request, editBodySchema)
          const caller = await resolveCommentCaller(request, body.site, 'write')
          responseOrigin = caller.responseOrigin
          const userId = caller.principal?.userId ?? null
          if (!userId && !body.editKey) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to edit your comments')
          await publishCommentOperation({
            operation: 'comment.edit',
            siteKey: body.site,
            userId,
            ...operationIdentity(caller),
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
          const caller = await resolveCommentCaller(request, site, 'write')
          responseOrigin = caller.responseOrigin
          const session = caller.principal
          if (!session) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to delete your comments')
          await publishCommentOperation({
            operation: 'comment.delete',
            siteKey: site,
            userId: session.userId,
            ...operationIdentity(caller),
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
        let origin: string | null = null
        const response = await withContext(async () => {
          origin = await resolvePreflightOrigin(request)
          return new Response(null, { status: 204 })
        })({ request })
        return applyCors(response, origin, 'PATCH, DELETE, OPTIONS')
      },
    },
  },
})
