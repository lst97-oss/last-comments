import { HttpStatus } from '@lst97-oss/last-httprism'
import { createFileRoute } from '@tanstack/react-router'
import { resolveSessionPrincipal } from '@/server/auth/resolve'
import { applyCors } from '@/server/http/cors'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { parseJsonBody, parseSearchParams } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { commentReactionSchema } from '@/server/modules/comments/http/comment-schemas'
import { assertFeatureOpen } from '@/server/modules/comments/http/feature-gate'
import { resolvePreflightOrigin } from '@/server/modules/comments/http/preflight'
import {
  addCommentReaction,
  removeCommentReaction,
  requireAllowedOrigin,
} from '@/server/modules/comments/infrastructure/comment-repository'
import { publishCommentOperation } from '@/server/plugins/comment-plugins'

const CORS_METHODS = 'PUT, DELETE, OPTIONS'

// No API-key support, as for votes: a reaction is made by a user identity.
export const Route = createFileRoute('/api/comments/reactions')({
  server: {
    handlers: {
      PUT: async (ctx) => {
        let responseOrigin: string | null = null
        const response = await withContext(async () => {
          const body = await parseJsonBody(ctx.request, commentReactionSchema)
          responseOrigin = await requireAllowedOrigin(body.site, ctx.request.headers.get('origin'))
          await assertFeatureOpen(body.site, 'commentReactions', 'write')
          const session = await resolveSessionPrincipal(ctx.request)
          if (!session)
            throw new HttpError(ErrorCode.UNAUTHENTICATED.status, ErrorCode.UNAUTHENTICATED.code, 'Sign in to react')
          await publishCommentOperation({
            operation: 'comment.react',
            siteKey: body.site,
            userId: session.userId,
            request: ctx.request,
          })
          const reactions = await addCommentReaction(body.site, body.commentId, session.userId, body.emoji)
          return { reactions }
        })(ctx)
        return applyCors(response, responseOrigin, CORS_METHODS)
      },
      DELETE: async (ctx) => {
        let responseOrigin: string | null = null
        const response = await withContext(async () => {
          const params = parseSearchParams(ctx.request.url, commentReactionSchema)
          responseOrigin = await requireAllowedOrigin(params.site, ctx.request.headers.get('origin'))
          await assertFeatureOpen(params.site, 'commentReactions', 'write')
          const session = await resolveSessionPrincipal(ctx.request)
          if (!session)
            throw new HttpError(ErrorCode.UNAUTHENTICATED.status, ErrorCode.UNAUTHENTICATED.code, 'Sign in to react')
          await publishCommentOperation({
            operation: 'comment.react',
            siteKey: params.site,
            userId: session.userId,
            request: ctx.request,
          })
          const reactions = await removeCommentReaction(params.site, params.commentId, session.userId, params.emoji)
          return { reactions }
        })(ctx)
        return applyCors(response, responseOrigin, CORS_METHODS)
      },
      OPTIONS: async (ctx) => {
        let responseOrigin: string | null = null
        const response = await withContext(async () => {
          responseOrigin = await resolvePreflightOrigin(ctx.request)
          return new Response(null, { status: HttpStatus.NO_CONTENT.code })
        })(ctx)
        return applyCors(response, responseOrigin, CORS_METHODS)
      },
    },
  },
})
