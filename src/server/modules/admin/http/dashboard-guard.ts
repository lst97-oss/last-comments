import { ErrorCode, HttpError } from '@/server/http/errors'
import { requireSessionUserId } from '@/server/http/route-guards'
import { hasDashboardAccess } from '@/server/modules/admin/infrastructure/dashboard-access'

// Session-only access to the dashboard's data. A signed-in member is refused, so the dashboard's
// own endpoints cannot be used around the shell's gate.
export async function requireDashboardUser(request: Request, message: string): Promise<string> {
  const userId = await requireSessionUserId(request, message)
  if (!(await hasDashboardAccess(userId))) {
    throw new HttpError(
      ErrorCode.FORBIDDEN.status,
      ErrorCode.FORBIDDEN.code,
      'The dashboard is restricted to administrators',
    )
  }
  return userId
}
