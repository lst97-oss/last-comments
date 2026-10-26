import { and, eq } from 'drizzle-orm'

import { type Principal, resolveSessionPrincipal } from '@/server/auth/resolve'
import { getBusinessDb } from '@/server/db/business-sql'
import { siteMemberships, type siteRole } from '@/server/db/schema'
import { getServerEnv } from '@/server/env'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { resolvePayloadServerUrl } from '@/server/security/payload-server-url'

// Pure so the rule can be tested without the environment. `publicOrigin` is the
// configured public origin, accepted alongside the request's own origin.
export function isAllowedOrigin(origin: string | null, requestUrl: string, publicOrigin: string | undefined): boolean {
  if (!origin) return false
  try {
    const candidate = new URL(origin).origin
    const allowed = [new URL(requestUrl).origin, publicOrigin && new URL(publicOrigin).origin]
    return allowed.includes(candidate)
  } catch {
    return false
  }
}

function configuredPublicOrigin(): string | undefined {
  try {
    return resolvePayloadServerUrl(getServerEnv())
  } catch {
    return undefined
  }
}

export function assertSameOrigin(request: Request, message: string): void {
  // Behind the TLS-terminating ingress the request URL is http://, so the
  // configured public origin is checked too.
  if (isAllowedOrigin(request.headers.get('origin'), request.url, configuredPublicOrigin())) return
  throw new HttpError(ErrorCode.ORIGIN_NOT_ALLOWED.status, ErrorCode.ORIGIN_NOT_ALLOWED.code, message)
}

export async function requirePrincipal(request: Request, message: string): Promise<Principal> {
  const principal = await resolveSessionPrincipal(request)
  if (!principal) throw new HttpError(ErrorCode.UNAUTHENTICATED.status, ErrorCode.UNAUTHENTICATED.code, message)
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

// The role a signed-in account has on a site, for authorship and display. Only admin rows are stored, so
// every other signed-in account is a `member`, and a guest (no user) has no role. Authorization must not
// use this: admin checks read the stored row through `isSiteAdmin`.
export async function getSiteRole(siteId: string, userId: string | null): Promise<MembershipRole | null> {
  if (userId === null) return null
  return (await getMembershipRole(siteId, userId)) ?? 'member'
}

// Every site-management and member-data read is admin-only. A member can comment and nothing else,
// so any membership is not enough: check the role, not the row.
export async function isSiteAdmin(siteId: string, userId: string): Promise<boolean> {
  return (await getMembershipRole(siteId, userId)) === 'admin'
}
