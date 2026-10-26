import { HttpStatus } from '@lst97-oss/last-httprism'
import { createFileRoute } from '@tanstack/react-router'
import { applyCors } from '@/server/http/cors'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { parseJsonBody, parseSearchParams, parseWith } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { operationIdentity, resolveCommentCaller } from '@/server/modules/comments/http/comment-caller'
import { deleteCommentData, editCommentData } from '@/server/modules/comments/http/comment-handler'
import {
  commentIdSchema,
  editBodySchema,
  editKeyHeaderSchema,
  siteQuerySchema,
} from '@/server/modules/comments/http/comment-schemas'
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
          if (!userId && !body.editKey)
            throw new HttpError(
              ErrorCode.UNAUTHENTICATED.status,
              ErrorCode.UNAUTHENTICATED.code,
              'Sign in to edit your comments',
            )
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
      // A signed-in author deletes with the session; a guest with the edit key from create time.
      DELETE: async ({ request, params }) => {
        let responseOrigin: string | null = null
        const response = await withContext(async () => {
          const { site } = parseSearchParams(request.url, siteQuerySchema)
          const caller = await resolveCommentCaller(request, site, 'write')
          responseOrigin = caller.responseOrigin
          const userId = caller.principal?.userId ?? null
          const rawEditKey = request.headers.get('x-lc-edit-key')
          const editKey = rawEditKey ? parseWith(editKeyHeaderSchema, rawEditKey) : undefined
          if (!userId && !editKey)
            throw new HttpError(
              ErrorCode.UNAUTHENTICATED.status,
              ErrorCode.UNAUTHENTICATED.code,
              'Sign in to delete your comments',
            )
          await publishCommentOperation({
            operation: 'comment.delete',
            siteKey: site,
            userId,
            ...operationIdentity(caller),
            request,
          })
          const comment = await deleteCommentData({
            siteKey: site,
            commentId: parseWith(commentIdSchema, params.commentId),
            userId,
            ...(editKey === undefined ? {} : { editKey }),
          })
          return { comment }
        })({ request })
        return applyCors(response, responseOrigin, 'PATCH, DELETE, OPTIONS')
      },
      OPTIONS: async ({ request }) => {
        let origin: string | null = null
        const response = await withContext(async () => {
          origin = await resolvePreflightOrigin(request)
          return new Response(null, { status: HttpStatus.NO_CONTENT.code })
        })({ request })
        return applyCors(response, origin, 'PATCH, DELETE, OPTIONS')
      },
    },
  },
})
