import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { HttpError } from '@/server/http/errors'
import { getMembershipRole, requireSessionUserId } from '@/server/http/route-guards'
import { parseSearchParams, parseWith } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { hasInstanceAdmin } from '@/server/modules/admin/infrastructure/admin-repository'
import { userCommentsQuerySchema } from '@/server/modules/comments/http/comment-schemas'
import { getSiteId, listUserComments } from '@/server/modules/comments/infrastructure/comment-repository'

// Session-only like the directory: comment history is moderator data, never
// served to service keys.
async function requireUserAccess(request: Request, siteKey: string): Promise<string> {
  const userId = await requireSessionUserId(request, 'Sign in to manage users')
  if (await hasInstanceAdmin(userId)) return getSiteId(siteKey)
  const siteId = await getSiteId(siteKey)
  if ((await getMembershipRole(siteId, userId)) === null) {
    throw new HttpError(403, 'FORBIDDEN', 'You cannot manage this site')
  }
  return siteId
}

const userIdParamSchema = z.string().min(1).max(255)

// Every comment one user posted on one site, newest first, hidden and
// deleted rows included. Powers the user history drawer.
export const Route = createFileRoute('/api/admin/users/$userId/comments')({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        withContext(async () => {
          const userId = parseWith(userIdParamSchema, params.userId)
          const { site, limit, offset } = parseSearchParams(request.url, userCommentsQuerySchema)
          return listUserComments(await requireUserAccess(request, site), userId, { limit, offset })
        })({ request }),
    },
  },
})
