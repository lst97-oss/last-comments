import { createFileRoute } from '@tanstack/react-router'

import { HttpError } from '@/server/http/errors'
import { assertSameOrigin, getMembershipRole, requireSessionUserId } from '@/server/http/route-guards'
import { parseJsonBody, parseSearchParams } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { hasInstanceAdmin } from '@/server/modules/admin/infrastructure/admin-repository'
import { hasServiceKey, requireServiceKey } from '@/server/modules/api-keys/infrastructure/api-key-repository'
import { pageBodySchema, pageDeleteQuerySchema, pagesQuerySchema } from '@/server/modules/comments/http/comment-schemas'
import { requirePageDeleteAccess } from '@/server/modules/comments/http/page-delete-access'
import {
  deletePage,
  getSiteId,
  listModerationPages,
  upsertPage,
} from '@/server/modules/comments/infrastructure/comment-repository'

// Session callers are instance admins or members of the target site; service
// keys need pages:read / pages:write bound to that exact site. Reads take no
// same-origin check (browsers omit Origin on same-origin GET).
async function requirePageAccess(
  request: Request,
  siteKey: string,
  scope: 'pages:read' | 'pages:write',
): Promise<void> {
  if (hasServiceKey(request)) {
    await requireServiceKey(request, scope, siteKey)
    return
  }
  if (scope === 'pages:write') assertSameOrigin(request, 'Page management must use the application origin')
  const userId = await requireSessionUserId(request, 'Sign in to manage pages')
  if (await hasInstanceAdmin(userId)) return
  if ((await getMembershipRole(await getSiteId(siteKey), userId)) === null) {
    throw new HttpError(403, 'FORBIDDEN', 'You cannot manage this site')
  }
}

// Page threads are usually created by the first comment; this endpoint lets a
// publishing site register them up front (idempotent) or claim a page key.
export const Route = createFileRoute('/api/admin/pages')({
  server: {
    handlers: {
      GET: ({ request }) =>
        withContext(async () => {
          const { site, recentDays, preview } = parseSearchParams(request.url, pagesQuerySchema)
          await requirePageAccess(request, site, 'pages:read')
          return {
            pages: await listModerationPages(await getSiteId(site), { recentDays, previewLimit: preview }),
          }
        })({ request }),
      POST: ({ request }) =>
        withContext(async () => {
          const body = await parseJsonBody(request, pageBodySchema)
          await requirePageAccess(request, body.site, 'pages:write')
          const page = await upsertPage(body.site, {
            url: body.url,
            ...(body.pageKey === undefined ? {} : { pageKey: body.pageKey }),
            ...(body.title === undefined ? {} : { title: body.title }),
          })
          return { page }
        })({ request }),
      DELETE: ({ request }) =>
        withContext(async () => {
          const { site, pageKey, url } = parseSearchParams(request.url, pageDeleteQuerySchema)
          if ((pageKey === undefined) === (url === undefined)) {
            throw new HttpError(400, 'VALIDATION_ERROR', 'Give exactly one of pageKey or url')
          }
          const actorUserId = await requirePageDeleteAccess(request, site)
          const target = pageKey === undefined ? { url: url ?? '' } : { pageKey }
          return deletePage(await getSiteId(site), actorUserId, target)
        })({ request }),
    },
  },
})
