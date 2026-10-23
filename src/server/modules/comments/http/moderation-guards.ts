import { HttpError } from '@/server/http/errors'
import { getMembershipRole, requireSessionUserId } from '@/server/http/route-guards'
import { hasInstanceAdmin } from '@/server/modules/admin/infrastructure/admin-repository'
import { getSiteId } from '@/server/modules/comments/infrastructure/comment-repository'

// Moderation data is session-only and admin-gated: the caller must be an
// instance admin and a member of the site. Shared by /api/moderation and
// /api/admin/takedowns so the two cannot drift apart.
export async function requireInstanceAdmin(request: Request) {
  const userId = await requireSessionUserId(request, 'Sign in to moderate comments')
  if (!(await hasInstanceAdmin(userId))) {
    throw new HttpError(403, 'FORBIDDEN', 'Moderation is restricted to administrators')
  }
  return { userId }
}

export async function requireSiteModerator(request: Request, siteKey: string) {
  const { userId } = await requireInstanceAdmin(request)
  const siteId = await getSiteId(siteKey)
  if ((await getMembershipRole(siteId, userId)) === null) {
    throw new HttpError(403, 'FORBIDDEN', 'You cannot moderate this site')
  }
  return { siteId, userId }
}
