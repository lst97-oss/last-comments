import { asc, count, eq, inArray, sql } from 'drizzle-orm'
import { getBusinessDb, getBusinessSql } from '@/server/db/business-sql'
import { apikey, comments, instanceAdmins, pages, siteMemberships, siteOrigins, sites, user } from '@/server/db/schema'
import { HttpError } from '@/server/http/errors'
import { canCreateInitialAdmin } from '@/server/modules/admin/domain/initial-setup'
import { attachOrigins } from '@/server/modules/comments/infrastructure/comment-repository'
import { getRequestLogger } from '@/server/observability/logger'

export async function hasInstanceAdmin(userId?: string): Promise<boolean> {
  const db = getBusinessDb()
  const rows = await db
    .select({ userId: instanceAdmins.userId })
    .from(instanceAdmins)
    .where(userId ? eq(instanceAdmins.userId, userId) : undefined)
    .limit(1)
  return rows.length > 0
}

export async function isInitialAdminSetupAvailable(): Promise<boolean> {
  const db = getBusinessDb()
  const [users] = await db.select({ value: count() }).from(user)
  const [admins] = await db.select({ value: count() }).from(instanceAdmins)
  return canCreateInitialAdmin(users?.value ?? 0, admins?.value ?? 0)
}

export async function createInitialAdmin<T extends { userId: string }>(createUser: () => Promise<T>): Promise<T> {
  const sql = getBusinessSql()
  return sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(736942185)`
    if (!(await isInitialAdminSetupAvailable())) {
      throw new HttpError(409, 'SETUP_UNAVAILABLE', 'Initial admin setup has already been used')
    }

    const result = await createUser()
    await tx`INSERT INTO instance_admins (slot, user_id) VALUES (1, ${result.userId})`
    return result
  })
}

export async function listAdminSites() {
  const db = getBusinessDb()
  const rows = await db
    .select({ id: sites.id, key: sites.key, name: sites.name, bodyLimit: sites.bodyLimit })
    .from(sites)
    .orderBy(asc(sites.name))
  return attachOrigins(db, rows)
}

// The sites one user is a member of. Instance admins use listAdminSites()
// instead — they see every site, members only their own.
export async function listAdminSitesForUser(userId: string) {
  const db = getBusinessDb()
  const rows = await db
    .select({ id: sites.id, key: sites.key, name: sites.name, bodyLimit: sites.bodyLimit })
    .from(siteMemberships)
    .innerJoin(sites, eq(siteMemberships.siteId, sites.id))
    .where(eq(siteMemberships.userId, userId))
    .orderBy(asc(sites.name))
  return attachOrigins(db, rows)
}

// Null rather than 404: the site detail route keeps unknown sites at 403 so
// non-admins cannot probe for existing keys.
export async function findSiteIdByKey(siteKey: string): Promise<string | null> {
  const db = getBusinessDb()
  const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey)).limit(1)
  return site?.id ?? null
}

// userId null = created via admin API key (no user to grant membership to).
// The site key is server-generated (slug of the name + random suffix), never
// client-supplied — the create dialog only asks for name + origin.
export async function createAdminSite(userId: string | null, input: { name: string; origin: string }) {
  const slug =
    input.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'site'
  const key = `${slug}-${crypto.randomUUID().slice(0, 8)}`
  const db = getBusinessDb()
  return db.transaction(async (tx) => {
    const [site] = await tx.insert(sites).values({ key, name: input.name }).returning()
    if (!site) throw new Error('Could not create site')
    await tx.insert(siteOrigins).values({ siteId: site.id, origin: input.origin })
    if (userId !== null) {
      await tx.insert(siteMemberships).values({ siteId: site.id, userId, role: 'admin' })
    }
    return { id: site.id, key: site.key, name: site.name, bodyLimit: site.bodyLimit }
  })
}

// Only the fields provided change, so a name edit never resets the comment limit.
export async function updateAdminSite(siteKey: string, input: { name?: string; bodyLimit?: number | null }) {
  const changes = {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.bodyLimit === undefined ? {} : { bodyLimit: input.bodyLimit }),
  }
  if (Object.keys(changes).length === 0) throw new HttpError(400, 'VALIDATION_ERROR', 'Provide a name or a bodyLimit')
  const db = getBusinessDb()
  const [site] = await db
    .update(sites)
    .set(changes)
    .where(eq(sites.key, siteKey))
    .returning({ id: sites.id, key: sites.key, name: sites.name, bodyLimit: sites.bodyLimit })
  if (!site) throw new HttpError(404, 'SITE_NOT_FOUND', 'Site was not found')
  return site
}

// better-auth's jsonb adapter round-trips metadata through JSON strings, so
// `metadata->>'siteKey'` matches nothing — unwrap in JS instead.
function siteKeyFromMetadata(metadata: unknown): string | null {
  let value = metadata
  while (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (typeof value !== 'object' || value === null || !('siteKey' in value)) return null
  return typeof value.siteKey === 'string' ? value.siteKey : null
}

// One transaction, so a failure leaves nothing half-deleted. The site row cascades
// to its origins, memberships, pages, comments, votes, blocks, verifications,
// moderation events and plugin events. The site's API keys are removed too, because
// their binding lives in JSON metadata the database cannot cascade on. The rate-limit
// windows are keyed by the site key, so they go as well. The counts are taken first,
// since the cascade removes the rows they describe, and the summary is logged.
export async function deleteAdminSite(siteKey: string): Promise<void> {
  const db = getBusinessDb()
  const summary = await db.transaction(async (tx) => {
    const [site] = await tx.select({ id: sites.id }).from(sites).where(eq(sites.key, siteKey)).limit(1)
    if (!site) throw new HttpError(404, 'SITE_NOT_FOUND', 'Site was not found')

    const [[pageTotal], [commentTotal], keys] = await Promise.all([
      tx.select({ value: count() }).from(pages).where(eq(pages.siteId, site.id)),
      tx
        .select({ value: count() })
        .from(comments)
        .innerJoin(pages, eq(comments.pageId, pages.id))
        .where(eq(pages.siteId, site.id)),
      tx.select({ id: apikey.id, metadata: apikey.metadata }).from(apikey),
    ])
    const orphaned = keys.filter((key) => siteKeyFromMetadata(key.metadata) === siteKey).map((key) => key.id)
    await Promise.all([
      orphaned.length > 0 ? tx.delete(apikey).where(inArray(apikey.id, orphaned)) : null,
      tx.execute(sql`delete from comment_rate_limit.rate_limit_windows where site_key = ${siteKey}`),
    ])
    await tx.delete(sites).where(eq(sites.id, site.id))

    return {
      pages: Number(pageTotal?.value ?? 0),
      comments: Number(commentTotal?.value ?? 0),
      apiKeys: orphaned.length,
    }
  })
  getRequestLogger().info('site.deleted', { siteKey, ...summary })
}
