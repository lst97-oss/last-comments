import { createFileRoute } from '@tanstack/react-router'

import { HttpError } from '@/server/http/errors'
import { getMembershipRole, requireSessionUserId } from '@/server/http/route-guards'
import { parseSearchParams } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { hasInstanceAdmin } from '@/server/modules/admin/infrastructure/admin-repository'
import { hasServiceKey, requireServiceKey } from '@/server/modules/api-keys/infrastructure/api-key-repository'
import { statsQuerySchema } from '@/server/modules/comments/http/comment-schemas'
import { getSiteId, getSiteStats } from '@/server/modules/comments/infrastructure/comment-repository'

// Same access rule as page management: service keys need pages:read bound to
// the site; sessions need instance admin or membership of that site. Reads
// take no same-origin check (browsers omit Origin on same-origin GET).
async function requireStatsAccess(request: Request, siteKey: string): Promise<void> {
  if (hasServiceKey(request)) {
    await requireServiceKey(request, 'pages:read', siteKey)
    return
  }
  const userId = await requireSessionUserId(request, 'Sign in to view dashboard stats')
  if (await hasInstanceAdmin(userId)) return
  if ((await getMembershipRole(await getSiteId(siteKey), userId)) === null) {
    throw new HttpError(403, 'FORBIDDEN', 'You cannot view this site')
  }
}

export const Route = createFileRoute('/api/admin/stats')({
  server: {
    handlers: {
      GET: ({ request }) =>
        withContext(async () => {
          const { site, days } = parseSearchParams(request.url, statsQuerySchema)
          await requireStatsAccess(request, site)
          const stats = await getSiteStats(await getSiteId(site), Number(days) as 7 | 30 | 90)
          return { stats }
        })({ request }),
    },
  },
})
