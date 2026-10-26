import { HttpStatus } from '@lst97-oss/last-httprism'
import { createFileRoute } from '@tanstack/react-router'
import { resolveSessionPrincipal } from '@/server/auth/resolve'
import { applyCors } from '@/server/http/cors'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { parseJsonBody, parseSearchParams } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { voteBodySchema, voteSearchSchema } from '@/server/modules/comments/http/comment-schemas'
import { resolvePreflightOrigin } from '@/server/modules/comments/http/preflight'
import {
  castCommentVote,
  clearCommentVote,
  getSiteAccess,
  requireAllowedOrigin,
} from '@/server/modules/comments/infrastructure/comment-repository'
import { publishCommentOperation } from '@/server/plugins/comment-plugins'

// Checked before the session, so a visitor on a site with voting off is told that rather than asked to sign in.
// A gateway-only site takes no browser traffic, and its keys cannot vote, so a session vote there would be the
// one path around the gateway.
async function assertVotingOpen(siteKey: string) {
  const site = await getSiteAccess(siteKey)
  if (site?.gatewayOnly)
    throw new HttpError(
      ErrorCode.FORBIDDEN.status,
      ErrorCode.FORBIDDEN.code,
      'This site does not accept votes from browsers',
    )
  if (site && !site.votesEnabled)
    throw new HttpError(
      ErrorCode.FEATURE_DISABLED.status,
      ErrorCode.FEATURE_DISABLED.code,
      'Voting is turned off for this site',
    )
}

export const Route = createFileRoute('/api/comments/vote')({
  server: {
    handlers: {
      // No API-key support by design: votes act as a user identity.
      PUT: async (ctx) => {
        let responseOrigin: string | null = null
        const response = await withContext(async () => {
          const body = await parseJsonBody(ctx.request, voteBodySchema)
          responseOrigin = await requireAllowedOrigin(body.site, ctx.request.headers.get('origin'))
          await assertVotingOpen(body.site)
          const session = await resolveSessionPrincipal(ctx.request)
          if (!session)
            throw new HttpError(ErrorCode.UNAUTHENTICATED.status, ErrorCode.UNAUTHENTICATED.code, 'Sign in to vote')
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
          await assertVotingOpen(params.site)
          const session = await resolveSessionPrincipal(ctx.request)
          if (!session)
            throw new HttpError(ErrorCode.UNAUTHENTICATED.status, ErrorCode.UNAUTHENTICATED.code, 'Sign in to vote')
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
          responseOrigin = await resolvePreflightOrigin(ctx.request)
          return new Response(null, { status: HttpStatus.NO_CONTENT.code })
        })(ctx)
        return applyCors(response, responseOrigin, 'PUT, DELETE, OPTIONS')
      },
    },
  },
})
