import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { ErrorCode, HttpError } from '@/server/http/errors'
import { isSiteAdmin, requireSessionUserId } from '@/server/http/route-guards'
import { parseSearchParams, parseWith } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { hasInstanceAdmin } from '@/server/modules/admin/infrastructure/admin-repository'
import { userCommentsQuerySchema } from '@/server/modules/comments/http/comment-schemas'
import { getSiteId, listUserComments } from '@/server/modules/comments/infrastructure/comment-repository'

// Same rule as the directory: instance admins and site admins only. This history includes hidden and
// deleted bodies, so a member must not read it. Session-only; service keys never read it.
async function requireUserAccess(request: Request, siteKey: string): Promise<string> {
  const userId = await requireSessionUserId(request, 'Sign in to manage users')
  if (await hasInstanceAdmin(userId)) return getSiteId(siteKey)
  const siteId = await getSiteId(siteKey)
  if (!(await isSiteAdmin(siteId, userId))) {
    throw new HttpError(
      ErrorCode.FORBIDDEN.status,
      ErrorCode.FORBIDDEN.code,
      'Only site admins can view a user history',
    )
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
