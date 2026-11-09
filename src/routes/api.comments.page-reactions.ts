import { HttpStatus } from '@lst97-oss/last-httprism'
import { createFileRoute } from '@tanstack/react-router'
import { resolveSessionPrincipal } from '@/server/auth/resolve'
import { applyCors } from '@/server/http/cors'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { parseJsonBody, parseSearchParams } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { resolveCommentCaller } from '@/server/modules/comments/http/comment-caller'
import { pageReactionQuerySchema, pageReactionSchema } from '@/server/modules/comments/http/comment-schemas'
import { assertFeatureOpen } from '@/server/modules/comments/http/feature-gate'
import { resolvePreflightOrigin } from '@/server/modules/comments/http/preflight'
import {
  addPageReaction,
  hasPageThread,
  listPageReactions,
  type PageRef,
  removePageReaction,
  requireAllowedOrigin,
} from '@/server/modules/comments/infrastructure/comment-repository'
import { publishCommentOperation } from '@/server/plugins/comment-plugins'

const CORS_METHODS = 'GET, PUT, DELETE, OPTIONS'

function pageRef(value: { url: string; pageKey?: string }): PageRef {
  return value.pageKey === undefined ? { pageUrl: value.url } : { pageUrl: value.url, pageKey: value.pageKey }
}

// The page bar. Reads follow the comment list's access rules; writes need a registered origin and a session.
export const Route = createFileRoute('/api/comments/page-reactions')({
  server: {
    handlers: {
      GET: async (ctx) => {
        let responseOrigin: string | null = null
        const response = await withContext(async () => {
          const query = parseSearchParams(ctx.request.url, pageReactionQuerySchema)
          const caller = await resolveCommentCaller(ctx.request, query.site, 'read')
          responseOrigin = caller.responseOrigin
          await assertFeatureOpen(query.site, 'pageReactions', 'read')
          const reactions = await listPageReactions(query.site, pageRef(query), caller.principal?.userId ?? null)
          return { reactions }
        })(ctx)
        return applyCors(response, responseOrigin, CORS_METHODS)
      },
      PUT: async (ctx) => {
        let responseOrigin: string | null = null
        const response = await withContext(async () => {
          const body = await parseJsonBody(ctx.request, pageReactionSchema)
          responseOrigin = await requireAllowedOrigin(body.site, ctx.request.headers.get('origin'))
          await assertFeatureOpen(body.site, 'pageReactions', 'write')
          const session = await resolveSessionPrincipal(ctx.request)
          if (!session)
            throw new HttpError(ErrorCode.UNAUTHENTICATED.status, ErrorCode.UNAUTHENTICATED.code, 'Sign in to react')
          // A reaction that would start the page's thread spends the thread budget, so a visitor cannot start
          // empty threads faster than a comment allows. Every other reaction spends the reaction budget.
          const startsThread = !(await hasPageThread(body.site, pageRef(body)))
          await publishCommentOperation({
            operation: startsThread ? 'page.create' : 'comment.react',
            siteKey: body.site,
            userId: session.userId,
            request: ctx.request,
          })
          const reactions = await addPageReaction(body.site, pageRef(body), session.userId, body.emoji)
          return { reactions }
        })(ctx)
        return applyCors(response, responseOrigin, CORS_METHODS)
      },
      DELETE: async (ctx) => {
        let responseOrigin: string | null = null
        const response = await withContext(async () => {
          const params = parseSearchParams(ctx.request.url, pageReactionSchema)
          responseOrigin = await requireAllowedOrigin(params.site, ctx.request.headers.get('origin'))
          await assertFeatureOpen(params.site, 'pageReactions', 'write')
          const session = await resolveSessionPrincipal(ctx.request)
          if (!session)
            throw new HttpError(ErrorCode.UNAUTHENTICATED.status, ErrorCode.UNAUTHENTICATED.code, 'Sign in to react')
          await publishCommentOperation({
            operation: 'comment.react',
            siteKey: params.site,
            userId: session.userId,
            request: ctx.request,
          })
          const reactions = await removePageReaction(params.site, pageRef(params), session.userId, params.emoji)
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
