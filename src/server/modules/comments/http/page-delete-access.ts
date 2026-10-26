import { ErrorCode, HttpError } from '@/server/http/errors'
import { assertSameOrigin, getMembershipRole, requireSessionUserId } from '@/server/http/route-guards'
import { hasInstanceAdmin } from '@/server/modules/admin/infrastructure/admin-repository'
import { hasServiceKey, requireServiceKey } from '@/server/modules/api-keys/infrastructure/api-key-repository'
import { getSiteId } from '@/server/modules/comments/infrastructure/comment-repository'

// Deleting a page removes its whole thread, so it is stricter than page writes. A
// service key needs pages:delete bound to that site, and its owner is the audit actor.
// A session must be same-origin and an instance admin or an admin of the site: any
// member is not enough. Returns the actor's user id for the audit row.
export async function requirePageDeleteAccess(request: Request, siteKey: string): Promise<string> {
  if (hasServiceKey(request)) {
    const key = await requireServiceKey(request, 'pages:delete', siteKey)
    return key.actorUserId
  }
  assertSameOrigin(request, 'Page deletion must use the application origin')
  const userId = await requireSessionUserId(request, 'Sign in to delete pages')
  if (await hasInstanceAdmin(userId)) return userId
  if ((await getMembershipRole(await getSiteId(siteKey), userId)) !== 'admin') {
    throw new HttpError(ErrorCode.FORBIDDEN.status, ErrorCode.FORBIDDEN.code, 'Only site admins can delete pages')
  }
  return userId
}
