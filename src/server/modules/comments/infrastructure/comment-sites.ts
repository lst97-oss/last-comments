import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { resolveBodyLimit } from '@/lib/comment-schema'
import type { SiteAccess } from '@/lib/site-access'
import { getBusinessDb } from '@/server/db/business-sql'
import { pages, siteOrigins, sites, userBlocks } from '@/server/db/schema'
import { ErrorCode, HttpError } from '@/server/http/errors'
import type { Db, Transaction } from '@/server/modules/comments/infrastructure/comment-types'

export async function assertSiteOrigin(
  siteKey: string,
  origin: string | null,
  db: Db = getBusinessDb(),
): Promise<string | null> {
  if (!origin) return null

  let normalizedOrigin: string
  try {
    normalizedOrigin = new URL(origin).origin
  } catch {
    throw new HttpError(ErrorCode.ORIGIN_NOT_ALLOWED.status, ErrorCode.ORIGIN_NOT_ALLOWED.code, 'Origin is not allowed')
  }

  const [allowed] = await db
    .select({ origin: siteOrigins.origin })
    .from(siteOrigins)
    .innerJoin(sites, eq(siteOrigins.siteId, sites.id))
    .where(and(eq(sites.key, siteKey), eq(siteOrigins.origin, normalizedOrigin)))
    .limit(1)
  if (!allowed)
    throw new HttpError(ErrorCode.ORIGIN_NOT_ALLOWED.status, ErrorCode.ORIGIN_NOT_ALLOWED.code, 'Origin is not allowed')
  return normalizedOrigin
}

// A CORS preflight for POST/PUT/PATCH has no `site` query parameter: the site
// travels in the JSON body, which the browser does not send on OPTIONS. The
// preflight therefore validates the origin against the union of registered
// sites; the actual request still checks the body's site against that origin.
export async function assertAnySiteOrigin(origin: string | null, db: Db = getBusinessDb()): Promise<string | null> {
  if (!origin) return null

  let normalizedOrigin: string
  try {
    normalizedOrigin = new URL(origin).origin
  } catch {
    throw new HttpError(ErrorCode.ORIGIN_NOT_ALLOWED.status, ErrorCode.ORIGIN_NOT_ALLOWED.code, 'Origin is not allowed')
  }

  const [allowed] = await db
    .select({ origin: siteOrigins.origin })
    .from(siteOrigins)
    .where(eq(siteOrigins.origin, normalizedOrigin))
    .limit(1)
  if (!allowed)
    throw new HttpError(ErrorCode.ORIGIN_NOT_ALLOWED.status, ErrorCode.ORIGIN_NOT_ALLOWED.code, 'Origin is not allowed')
  return normalizedOrigin
}

// Write paths (comment create/edit/delete, vote) require an origin; reads
// tolerate a missing one because browsers omit Origin on same-origin GET.
export async function requireAllowedOrigin(
  siteKey: string,
  origin: string | null,
  db: Db = getBusinessDb(),
): Promise<string> {
  const allowedOrigin = await assertSiteOrigin(siteKey, origin, db)
  if (!allowedOrigin)
    throw new HttpError(ErrorCode.ORIGIN_NOT_ALLOWED.status, ErrorCode.ORIGIN_NOT_ALLOWED.code, 'Origin is not allowed')
  return allowedOrigin
}

export async function assertCommenterAllowed(
  tx: Transaction,
  siteId: string,
  userId: string,
  message: string,
): Promise<void> {
  const [block] = await tx
    .select({ id: userBlocks.id })
    .from(userBlocks)
    .where(
      and(
        eq(userBlocks.siteId, siteId),
        eq(userBlocks.userId, userId),
        or(isNull(userBlocks.expiresAt), gt(userBlocks.expiresAt, new Date())),
      ),
    )
    .limit(1)
  if (block) throw new HttpError(ErrorCode.USER_BLOCKED.status, ErrorCode.USER_BLOCKED.code, message)
}

export async function getSiteId(siteKey: string, db: Db = getBusinessDb()): Promise<string> {
  const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey)).limit(1)
  if (!site) throw new HttpError(ErrorCode.SITE_NOT_FOUND.status, ErrorCode.SITE_NOT_FOUND.code, 'Site was not found')
  return site.id
}

// Every site fact a comment request needs, from one read: the policy columns, and whether the
// caller's origin is one the site registered. Null for an unknown site; the caller decides what that means.
export async function getSiteContext(
  siteKey: string,
  origin: string | null,
  db: Db = getBusinessDb(),
): Promise<{
  id: string
  access: SiteAccess
  gatewayOnly: boolean
  votesEnabled: boolean
  bodyLimit: number | null
  originRegistered: boolean
} | null> {
  const [site] = await db
    .select({
      id: sites.id,
      access: sites.access,
      gatewayOnly: sites.gatewayOnly,
      votesEnabled: sites.votesEnabled,
      bodyLimit: sites.bodyLimit,
      // A join, not a correlated subquery: drizzle drops table qualifiers in a single-table select, which
      // would compare site_origins with itself. The unique (site_id, origin) index keeps this to one row.
      originRegistered: sql<boolean>`${siteOrigins.id} is not null`,
    })
    .from(sites)
    .leftJoin(
      siteOrigins,
      origin === null ? sql`false` : and(eq(siteOrigins.siteId, sites.id), eq(siteOrigins.origin, origin)),
    )
    .where(eq(sites.key, siteKey))
    .limit(1)
  return site ?? null
}

// Null for an unknown site: the caller then keeps today's behaviour, and the
// origin check still refuses unregistered writers.
export async function getSiteAccess(
  siteKey: string,
  db: Db = getBusinessDb(),
): Promise<{ access: SiteAccess; gatewayOnly: boolean; votesEnabled: boolean } | null> {
  const [site] = await db
    .select({ access: sites.access, gatewayOnly: sites.gatewayOnly, votesEnabled: sites.votesEnabled })
    .from(sites)
    .where(eq(sites.key, siteKey))
    .limit(1)
  return site ?? null
}

// The stored limit is null for the default; the caller resolves it to the ceiling.
export async function getPublicSiteSettingsRow(
  siteKey: string,
  db: Db = getBusinessDb(),
): Promise<{ access: SiteAccess; bodyLimit: number | null; votesEnabled: boolean } | null> {
  const [site] = await db
    .select({ access: sites.access, bodyLimit: sites.bodyLimit, votesEnabled: sites.votesEnabled })
    .from(sites)
    .where(eq(sites.key, siteKey))
    .limit(1)
  return site ?? null
}

// Site-scoped on purpose: the moderator composer addresses a thread by page id
// and must never reach another site's page.
export async function getPageCanonicalUrl(
  siteId: string,
  pageId: string,
  db: Db = getBusinessDb(),
): Promise<string | null> {
  const [page] = await db
    .select({ canonicalUrl: pages.canonicalUrl })
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.id, pageId)))
    .limit(1)
  return page?.canonicalUrl ?? null
}

// A site's comment limit lives in its row, so every write reads it.
export async function getSiteLimits(siteKey: string, db: Db): Promise<{ id: string; bodyLimit: number }> {
  const [site] = await db
    .select({ id: sites.id, bodyLimit: sites.bodyLimit })
    .from(sites)
    .where(eq(sites.key, siteKey))
    .limit(1)
  if (!site) throw new HttpError(ErrorCode.SITE_NOT_FOUND.status, ErrorCode.SITE_NOT_FOUND.code, 'Site was not found')
  return { id: site.id, bodyLimit: resolveBodyLimit(site.bodyLimit) }
}

// The body is the trimmed string the schema hands over. The widget counts before
// trimming, so it is at least as strict as this check.
export function assertWithinBodyLimit(bodyMarkdown: string, bodyLimit: number): void {
  if (bodyMarkdown.length > bodyLimit) {
    throw new HttpError(
      ErrorCode.COMMENT_TOO_LONG.status,
      ErrorCode.COMMENT_TOO_LONG.code,
      `Comments on this site are limited to ${bodyLimit} characters`,
    )
  }
}

// Edits screen before their transaction (no database lock is held during LLM I/O),
// so an oversized edit is refused here before any screening runs.
export async function assertCommentFitsSite(
  siteKey: string,
  bodyMarkdown: string,
  db: Db = getBusinessDb(),
): Promise<void> {
  assertWithinBodyLimit(bodyMarkdown, (await getSiteLimits(siteKey, db)).bodyLimit)
}
