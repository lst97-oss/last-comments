import { and, eq } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { siteMemberships } from '@/server/db/schema'
import { hasInstanceAdmin } from '@/server/modules/admin/infrastructure/admin-repository'

// The dashboard is for admins: the instance admin, or an admin of at least one site. A member can comment
// and nothing else, and a signed-in account with no site role has no dashboard either.
export async function hasDashboardAccess(userId: string): Promise<boolean> {
  if (await hasInstanceAdmin(userId)) return true
  const [row] = await getBusinessDb()
    .select({ id: siteMemberships.id })
    .from(siteMemberships)
    .where(and(eq(siteMemberships.userId, userId), eq(siteMemberships.role, 'admin')))
    .limit(1)
  return Boolean(row)
}
