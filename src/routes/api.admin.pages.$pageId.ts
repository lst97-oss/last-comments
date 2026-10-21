import { createFileRoute } from '@tanstack/react-router'

import { HttpError } from '@/server/http/errors'
import { getMembershipRole, requireSessionUserId } from '@/server/http/route-guards'
import { parseSearchParams, parseWith } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { hasInstanceAdmin } from '@/server/modules/admin/infrastructure/admin-repository'
import { hasServiceKey, requireServiceKey } from '@/server/modules/api-keys/infrastructure/api-key-repository'
import { commentIdSchema, statsQuerySchema } from '@/server/modules/comments/http/comment-schemas'
import { getPageThread, getSiteId } from '@/server/modules/comments/infrastructure/comment-repository'

// Session callers are instance admins or members of the target site; service
// keys need pages:read bound to that exact site. Reads take no same-origin
// check (browsers omit Origin on same-origin GET).
async function requirePageDetailAccess(request: Request, siteKey: string): Promise<void> {
  if (hasServiceKey(request)) {
    await requireServiceKey(request, 'pages:read', siteKey)
    return
  }
  const userId = await requireSessionUserId(request, 'Sign in to view threads')
  if (await hasInstanceAdmin(userId)) return
  if ((await getMembershipRole(await getSiteId(siteKey), userId)) === null) {
    throw new HttpError(403, 'FORBIDDEN', 'You cannot view this site')
  }
}

export const Route = createFileRoute('/api/admin/pages/$pageId')({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        withContext(async () => {
          const pageId = parseWith(commentIdSchema, params.pageId)
          const { site, days } = parseSearchParams(request.url, statsQuerySchema)
          await requirePageDetailAccess(request, site)
          return getPageThread(await getSiteId(site), pageId, Number(days) as 7 | 30 | 90)
        })({ request }),
    },
  },
})
