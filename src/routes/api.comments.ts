import { HttpStatus } from '@lst97-oss/last-httprism'
import { createFileRoute } from '@tanstack/react-router'
import { applyCors } from '@/server/http/cors'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { parseJsonBody, parseSearchParams } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { operationIdentity, resolveCommentCaller } from '@/server/modules/comments/http/comment-caller'
import { createCommentData } from '@/server/modules/comments/http/comment-handler'
import { commentBodySchema, searchSchema } from '@/server/modules/comments/http/comment-schemas'
import { assertPageOriginAllowed } from '@/server/modules/comments/http/page-origin'
import { resolvePreflightOrigin } from '@/server/modules/comments/http/preflight'
import { listPageComments } from '@/server/modules/comments/infrastructure/comment-repository'
import { publishCommentOperation } from '@/server/plugins/comment-plugins'

export const Route = createFileRoute('/api/comments')({
  server: {
    handlers: {
      GET: async (ctx) => {
        let responseOrigin: string | null = null
        const response = await withContext(async () => {
          const { site, url, pageKey, limit, offset } = parseSearchParams(ctx.request.url, searchSchema)
          const caller = await resolveCommentCaller(ctx.request, site, 'read')
          responseOrigin = caller.responseOrigin
          const comments = await listPageComments(site, url ?? '', {
            limit,
            offset,
            viewerUserId: caller.principal?.userId ?? null,
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
          const caller = await resolveCommentCaller(ctx.request, body.site, 'write')
          responseOrigin = caller.responseOrigin
          await assertPageOriginAllowed(caller, body.site, body.url)
          const user = caller.principal
          if (!user && !body.authorName) {
            throw new HttpError(
              ErrorCode.AUTHOR_NAME_REQUIRED.status,
              ErrorCode.AUTHOR_NAME_REQUIRED.code,
              'A display name is required for guest comments',
            )
          }
          await publishCommentOperation({
            operation: 'comment.create',
            siteKey: body.site,
            userId: user?.userId ?? null,
            ...operationIdentity(caller),
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
          return new Response(null, { status: HttpStatus.NO_CONTENT.code })
        })({ request })
        return applyCors(response, origin, 'GET, POST, OPTIONS')
      },
    },
  },
})
