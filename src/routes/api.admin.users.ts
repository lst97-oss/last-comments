import { createFileRoute } from '@tanstack/react-router'

import { HttpError } from '@/server/http/errors'
import { getMembershipRole, requireSessionUserId } from '@/server/http/route-guards'
import { parseSearchParams } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { hasInstanceAdmin } from '@/server/modules/admin/infrastructure/admin-repository'
import { usersQuerySchema } from '@/server/modules/comments/http/comment-schemas'
import { getSiteId, listSiteUsers } from '@/server/modules/comments/infrastructure/comment-repository'

// Session-only: the directory carries names and emails, so unlike the thread
// list it is never served to service keys. Instance admins see every site;
// site admins see their own sites. Site moderators are excluded — the
// directory is personal data a moderator has no business reading.
async function requireUserAccess(request: Request, siteKey: string): Promise<string> {
  const userId = await requireSessionUserId(request, 'Sign in to manage users')
  if (await hasInstanceAdmin(userId)) return getSiteId(siteKey)
  const siteId = await getSiteId(siteKey)
  if ((await getMembershipRole(siteId, userId)) !== 'admin') {
    throw new HttpError(403, 'FORBIDDEN', 'Only site admins can view the user directory')
  }
  return siteId
}

export const Route = createFileRoute('/api/admin/users')({
  server: {
    handlers: {
      GET: ({ request }) =>
        withContext(async () => {
          const { site, search, filter, limit, offset } = parseSearchParams(request.url, usersQuerySchema)
          return listSiteUsers(await requireUserAccess(request, site), { search, filter, limit, offset })
        })({ request }),
    },
  },
})
