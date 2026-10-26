import { createFileRoute } from '@tanstack/react-router'

import { parseSearchParams } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { takedownsQuerySchema } from '@/server/modules/comments/http/comment-schemas'
import { requireSiteAdmin } from '@/server/modules/comments/http/moderation-guards'
import { listModerationTakedowns } from '@/server/modules/comments/infrastructure/comment-repository'

// Hidden and deleted comments for the Recent tab's Hidden & removed list.
// Session-only like /api/moderation: API keys never read moderation data.
export const Route = createFileRoute('/api/admin/takedowns')({
  server: {
    handlers: {
      GET: ({ request }) =>
        withContext(async () => {
          const { site, recentDays, limit, offset } = parseSearchParams(request.url, takedownsQuerySchema)
          const siteAdmin = await requireSiteAdmin(request, site)
          return listModerationTakedowns(siteAdmin.siteId, { recentDays, limit, offset })
        })({ request }),
    },
  },
})
