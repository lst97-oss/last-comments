import { ErrorCode, HttpError } from '@/server/http/errors'
import { isSiteAdmin, requireSessionUserId } from '@/server/http/route-guards'
import { hasInstanceAdmin } from '@/server/modules/admin/infrastructure/admin-repository'
import { getSiteId } from '@/server/modules/comments/infrastructure/comment-repository'

// Moderation data is session-only and admin-gated: the caller must be an
// instance admin and an admin of the site. Shared by /api/moderation and
// /api/admin/takedowns so the two cannot drift apart.
export async function requireInstanceAdmin(request: Request) {
  const userId = await requireSessionUserId(request, 'Sign in to moderate comments')
  if (!(await hasInstanceAdmin(userId))) {
    throw new HttpError(
      ErrorCode.FORBIDDEN.status,
      ErrorCode.FORBIDDEN.code,
      'Moderation is restricted to administrators',
    )
  }
  return { userId }
}

// A member of the site can comment but cannot moderate it, so the membership must carry the admin role.
export async function requireSiteAdmin(request: Request, siteKey: string) {
  const { userId } = await requireInstanceAdmin(request)
  const siteId = await getSiteId(siteKey)
  if (!(await isSiteAdmin(siteId, userId))) {
    throw new HttpError(ErrorCode.FORBIDDEN.status, ErrorCode.FORBIDDEN.code, 'You cannot moderate this site')
  }
  return { siteId, userId }
}
