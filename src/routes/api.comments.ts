import { createFileRoute } from '@tanstack/react-router'
import { resolveSessionPrincipal } from '@/server/auth/resolve'
import { applyCors } from '@/server/http/cors'
import { HttpError } from '@/server/http/errors'
import { parseJsonBody, parseSearchParams } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { createCommentData } from '@/server/modules/comments/http/comment-handler'
import { commentBodySchema, searchSchema } from '@/server/modules/comments/http/comment-schemas'
import { resolvePreflightOrigin } from '@/server/modules/comments/http/preflight'
import {
  assertSiteOrigin,
  listPageComments,
  requireAllowedOrigin,
} from '@/server/modules/comments/infrastructure/comment-repository'
import { publishCommentOperation } from '@/server/plugins/comment-plugins'

export const Route = createFileRoute('/api/comments')({
  server: {
    handlers: {
      GET: async (ctx) => {
        let responseOrigin: string | null = null
        const response = await withContext(async () => {
          const { site, url, pageKey, limit, offset } = parseSearchParams(ctx.request.url, searchSchema)
          responseOrigin = await assertSiteOrigin(site, ctx.request.headers.get('origin'))
          const session = ctx.request.headers.get('cookie') ? await resolveSessionPrincipal(ctx.request) : null
          const comments = await listPageComments(site, url ?? '', {
            limit,
            offset,
            viewerUserId: session?.userId ?? null,
            ...(pageKey === undefined ? {} : { pageKey }),
          })
          return { comments }
        })(ctx)
        return applyCors(response, responseOrigin, 'GET, POST, OPTIONS')
      },
      POST: async (ctx) => {
        let responseOrigin: string | null = null
        const response = await withContext(async () => {
          const body = await parseJsonBody(ctx.request, commentBodySchema)
          responseOrigin = await requireAllowedOrigin(body.site, ctx.request.headers.get('origin'))
          const session = await resolveSessionPrincipal(ctx.request)
          const user = session
          if (!user && !body.authorName) {
            throw new HttpError(400, 'AUTHOR_NAME_REQUIRED', 'A display name is required for guest comments')
          }
          await publishCommentOperation({
            operation: 'comment.create',
            siteKey: body.site,
            userId: user?.userId ?? null,
            request: ctx.request,
          })
          const comment = await createCommentData({
            siteKey: body.site,
            pageUrl: body.url,
            ...(body.pageKey === undefined ? {} : { pageKey: body.pageKey }),
            ...(body.title === undefined ? {} : { title: body.title }),
            parentId: body.parentId,
            userId: user?.userId ?? null,
            authorName: user?.displayName ?? body.authorName!,
            bodyMarkdown: body.bodyMarkdown,
            verificationToken: body.verificationToken,
          })
          return { comment: { ...comment, avatarUrl: user?.image ?? null } }
        })(ctx)
        return applyCors(response, responseOrigin, 'GET, POST, OPTIONS')
      },
      OPTIONS: async ({ request }) => {
        let origin: string | null = null
        const response = await withContext(async () => {
          origin = await resolvePreflightOrigin(request)
          return new Response(null, { status: 204 })
        })({ request })
        return applyCors(response, origin, 'GET, POST, OPTIONS')
      },
    },
  },
})
