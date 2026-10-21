import { and, eq } from 'drizzle-orm'

import { type Principal, resolveSessionPrincipal } from '@/server/auth/resolve'
import { getBusinessDb } from '@/server/db/business-sql'
import { siteMemberships, type siteRole } from '@/server/db/schema'
import { HttpError } from '@/server/http/errors'

export function assertSameOrigin(request: Request, message: string): void {
  const origin = request.headers.get('origin')
  try {
    if (origin && new URL(origin).origin === new URL(request.url).origin) return
  } catch {}
  throw new HttpError(403, 'ORIGIN_NOT_ALLOWED', message)
}

export async function requirePrincipal(request: Request, message: string): Promise<Principal> {
  const principal = await resolveSessionPrincipal(request)
  if (!principal) throw new HttpError(401, 'UNAUTHENTICATED', message)
  return principal
}

export async function requireSessionUserId(request: Request, message: string): Promise<string> {
  return (await requirePrincipal(request, message)).userId
}

export type MembershipRole = (typeof siteRole.enumValues)[number]

export async function getMembershipRole(siteId: string, userId: string): Promise<MembershipRole | null> {
  const [membership] = await getBusinessDb()
    .select({ role: siteMemberships.role })
    .from(siteMemberships)
    .where(and(eq(siteMemberships.siteId, siteId), eq(siteMemberships.userId, userId)))
    .limit(1)
  return membership?.role ?? null
}
