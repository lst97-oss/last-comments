import { createFileRoute } from '@tanstack/react-router'

import { resolveSessionPrincipal } from '@/server/auth/resolve'
import { applyCors } from '@/server/http/cors'
import { HttpError } from '@/server/http/errors'
import { parseJsonBody, parseSearchParams } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { siteQuerySchema, voteBodySchema, voteSearchSchema } from '@/server/modules/comments/http/comment-schemas'
import {
  castCommentVote,
  clearCommentVote,
  requireAllowedOrigin,
} from '@/server/modules/comments/infrastructure/comment-repository'
import { publishCommentOperation } from '@/server/plugins/comment-plugins'

export const Route = createFileRoute('/api/comments/vote')({
  server: {
    handlers: {
      // No API-key support by design: votes act as a user identity.
      PUT: async (ctx) => {
        let responseOrigin: string | null = null
        const response = await withContext(async () => {
          const body = await parseJsonBody(ctx.request, voteBodySchema)
          responseOrigin = await requireAllowedOrigin(body.site, ctx.request.headers.get('origin'))
          const session = await resolveSessionPrincipal(ctx.request)
          if (!session) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to vote')
          await publishCommentOperation({
            operation: 'comment.vote',
            siteKey: body.site,
            userId: session.userId,
            request: ctx.request,
          })
          const vote = await castCommentVote(body.site, body.commentId, session.userId, body.value)
          return { vote }
        })(ctx)
        return applyCors(response, responseOrigin, 'PUT, DELETE, OPTIONS')
      },
      DELETE: async (ctx) => {
        let responseOrigin: string | null = null
        const response = await withContext(async () => {
          const params = parseSearchParams(ctx.request.url, voteSearchSchema)
          responseOrigin = await requireAllowedOrigin(params.site, ctx.request.headers.get('origin'))
          const session = await resolveSessionPrincipal(ctx.request)
          if (!session) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in to vote')
          await publishCommentOperation({
            operation: 'comment.vote',
            siteKey: params.site,
            userId: session.userId,
            request: ctx.request,
          })
          const vote = await clearCommentVote(params.site, params.commentId, session.userId)
          return { vote }
        })(ctx)
        return applyCors(response, responseOrigin, 'PUT, DELETE, OPTIONS')
      },
      OPTIONS: async (ctx) => {
        let responseOrigin: string | null = null
        const response = await withContext(async () => {
          const { site } = parseSearchParams(ctx.request.url, siteQuerySchema)
          responseOrigin = await requireAllowedOrigin(site, ctx.request.headers.get('origin'))
          return new Response(null, { status: 204 })
        })(ctx)
        return applyCors(response, responseOrigin, 'PUT, DELETE, OPTIONS')
      },
    },
  },
})
