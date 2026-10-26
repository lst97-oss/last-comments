import { eq } from 'drizzle-orm'

import { API_KEY_SCOPES, type ApiKeyScope } from '@/lib/api-key-scopes'
import { type ApiKeyRecord, SITE_BOUND_SCOPES } from '@/lib/api-keys'
import { getBusinessAuth } from '@/server/auth/business-auth'
import { getBusinessDb } from '@/server/db/business-sql'
import { apiKeySites, apikey, sites } from '@/server/db/schema'
import { ErrorCode, HttpError } from '@/server/http/errors'

export { API_KEY_SCOPES, type ApiKeyScope }

const SCOPE_TO_PERMISSION: Record<ApiKeyScope, { resource: string; action: string }> = {
  'sites:create': { resource: 'sites', action: 'create' },
  'sites:read': { resource: 'sites', action: 'read' },
  'sites:update': { resource: 'sites', action: 'update' },
  'sites:delete': { resource: 'sites', action: 'delete' },
  'pages:read': { resource: 'pages', action: 'read' },
  'pages:write': { resource: 'pages', action: 'write' },
  'pages:delete': { resource: 'pages', action: 'delete' },
  'comments:read': { resource: 'comments', action: 'read' },
  'comments:write': { resource: 'comments', action: 'write' },
}

export function scopesToPermissions(scopes: ApiKeyScope[]): Record<string, string[]> {
  const permissions: Record<string, string[]> = {}
  for (const scope of scopes) {
    const { resource, action } = SCOPE_TO_PERMISSION[scope]
    const actions = permissions[resource] ?? []
    if (!actions.includes(action)) actions.push(action)
    permissions[resource] = actions
  }
  return permissions
}

export function assertValidScopeSet(siteKey: string | null, scopes: ApiKeyScope[]): void {
  const allowed =
    siteKey === null
      ? (['sites:create', 'sites:read', 'sites:update', 'sites:delete'] as const)
      : (['pages:read', 'pages:write', 'pages:delete', 'comments:read', 'comments:write'] as const)
  if (scopes.length === 0 || !scopes.every((scope) => (allowed as readonly string[]).includes(scope))) {
    throw new HttpError(
      ErrorCode.INVALID_SCOPE_SET.status,
      ErrorCode.INVALID_SCOPE_SET.code,
      'Scope set is not valid for this key type',
    )
  }
}

export type ResolvedServiceKey = {
  id: string
  siteKey: string | null
  name: string | null
  actorUserId: string
  scopes: ApiKeyScope[]
}

const PERMISSION_TO_SCOPE: Record<string, ApiKeyScope> = Object.fromEntries(
  Object.entries(SCOPE_TO_PERMISSION).map(([scope, { resource, action }]) => [
    `${resource}:${action}`,
    scope as ApiKeyScope,
  ]),
)

export function permissionsToScopes(permissions: unknown): ApiKeyScope[] {
  if (typeof permissions === 'string') {
    try {
      permissions = JSON.parse(permissions)
    } catch {
      return []
    }
  }
  if (typeof permissions !== 'object' || permissions === null) return []
  const scopes: ApiKeyScope[] = []
  for (const [resource, actions] of Object.entries(permissions as Record<string, unknown>)) {
    if (!Array.isArray(actions)) continue
    for (const action of actions) {
      const scope = PERMISSION_TO_SCOPE[`${resource}:${String(action)}`]
      if (scope && !scopes.includes(scope)) scopes.push(scope)
    }
  }
  return scopes
}

type BusinessDb = ReturnType<typeof getBusinessDb>

// The site a key is bound to, read from api_key_sites. Null for an instance key.
async function boundSiteKeyOf(keyId: string, db: BusinessDb = getBusinessDb()): Promise<string | null> {
  const [row] = await db
    .select({ siteKey: sites.key })
    .from(apiKeySites)
    .innerJoin(sites, eq(apiKeySites.siteId, sites.id))
    .where(eq(apiKeySites.apiKeyId, keyId))
    .limit(1)
  return row?.siteKey ?? null
}

// Service keys live in `x-api-key` or in `Authorization`. Only the
// `lck_` prefix marks an Authorization header as a service key: an OIDC/IdP
// bearer token must fall through to the session adapters, not to key
// verification.
const API_KEY_PREFIX = 'lck_'

function extractBearer(request: Request): string | null {
  const explicit = request.headers.get('x-api-key')?.trim()
  if (explicit) return explicit
  const raw = request.headers.get('authorization')?.trim()
  if (!raw) return null
  const secret = /^bearer\s+/i.test(raw) ? raw.replace(/^bearer\s+/i, '').trim() : raw
  return secret.startsWith(API_KEY_PREFIX) ? secret : null
}

export function hasServiceKey(request: Request): boolean {
  return extractBearer(request) !== null
}

// Verify + permission-check in one call: the plugin checks the permissions map,
// and the site binding comes from api_key_sites. A key that needs a site but has no
// binding is refused, so a half-created key cannot act on an instance route either.
export async function requireServiceKey(
  request: Request,
  scope: ApiKeyScope,
  siteKey?: string,
): Promise<ResolvedServiceKey> {
  const secret = extractBearer(request)
  if (!secret)
    throw new HttpError(ErrorCode.INVALID_API_KEY.status, ErrorCode.INVALID_API_KEY.code, 'API key is required')
  const { resource, action } = SCOPE_TO_PERMISSION[scope]
  const auth = getBusinessAuth()
  const result = await auth.api.verifyApiKey({ body: { key: secret, permissions: { [resource]: [action] } } })
  if (!result.valid || !result.key) {
    const code = result.error?.code
    if (code === 'KEY_NOT_FOUND')
      throw new HttpError(
        ErrorCode.INSUFFICIENT_SCOPE.status,
        ErrorCode.INSUFFICIENT_SCOPE.code,
        'API key lacks the required permission',
      )
    throw new HttpError(
      ErrorCode.INVALID_API_KEY.status,
      ErrorCode.INVALID_API_KEY.code,
      'API key is invalid, revoked, or expired',
    )
  }
  const boundSiteKey = await boundSiteKeyOf(result.key.id)
  if (boundSiteKey === null && SITE_BOUND_SCOPES.includes(scope)) {
    throw new HttpError(
      ErrorCode.INSUFFICIENT_SCOPE.status,
      ErrorCode.INSUFFICIENT_SCOPE.code,
      'API key is not bound to a site',
    )
  }
  if (boundSiteKey !== (siteKey ?? null)) {
    throw new HttpError(
      ErrorCode.INSUFFICIENT_SCOPE.status,
      ErrorCode.INSUFFICIENT_SCOPE.code,
      'API key is not authorized for this site',
    )
  }
  return {
    id: result.key.id,
    siteKey: boundSiteKey,
    name: result.key.name,
    actorUserId: result.key.referenceId,
    scopes: permissionsToScopes(result.key.permissions),
  }
}

// Server-side key issuance: permissions and the site binding are set here, never
// from client input. Unbound keys hold sites:* (manage sites); site-bound keys
// hold pages:* and comments:* for exactly one site. Must run headerless: the plugin
// rejects server-only fields (permissions) whenever request headers are present.
export async function issueServiceKey(input: {
  userId: string
  name: string
  siteKey: string | null
  scopes: ApiKeyScope[]
  expiresIn?: number
}) {
  assertValidScopeSet(input.siteKey, input.scopes)
  const db = getBusinessDb()
  // Resolve the site before the key exists, so an unknown site creates nothing.
  const [site] = input.siteKey
    ? await db.select({ id: sites.id }).from(sites).where(eq(sites.key, input.siteKey)).limit(1)
    : []
  if (input.siteKey && !site)
    throw new HttpError(ErrorCode.SITE_NOT_FOUND.status, ErrorCode.SITE_NOT_FOUND.code, 'Site was not found')

  const created = await getBusinessAuth().api.createApiKey({
    body: {
      userId: input.userId,
      name: input.name,
      prefix: 'lck_',
      permissions: scopesToPermissions(input.scopes),
      rateLimitEnabled: false,
      ...(input.expiresIn ? { expiresIn: input.expiresIn } : {}),
    },
  })
  if (site) {
    try {
      await db.insert(apiKeySites).values({ apiKeyId: created.id, siteId: site.id })
    } catch (error) {
      // A key without its binding is refused, so the key is removed rather than left behind.
      await db.delete(apikey).where(eq(apikey.id, created.id))
      throw error
    }
  }
  return created
}

// Provider-neutral reads/writes straight against our own apikey table. The
// plugin's /api-key/* endpoints resolve the caller from a better-auth session
// cookie, so they cannot serve header/OIDC dashboard users; these helpers run
// under the route's own session guard instead. Storage format matches the
// plugin exactly (permissions as JSON text), so both paths see the same keys.
function parseKeyPermissions(permissions: string | null): Record<string, string[]> | null {
  if (!permissions) return null
  try {
    const parsed: unknown = JSON.parse(permissions)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    const result: Record<string, string[]> = {}
    for (const [resource, actions] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(actions))
        result[resource] = actions.filter((action): action is string => typeof action === 'string')
    }
    return result
  } catch {
    return null
  }
}

export function toPluginKey(row: {
  id: string
  name: string | null
  start: string | null
  prefix: string | null
  enabled: boolean | null
  expiresAt: Date | null
  createdAt: Date
  siteKey: string | null
  permissions: string | null
}): ApiKeyRecord {
  return {
    id: row.id,
    name: row.name,
    start: row.start,
    prefix: row.prefix,
    enabled: row.enabled ?? true,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    metadata: row.siteKey === null ? null : { site: row.siteKey },
    permissions: parseKeyPermissions(row.permissions),
  }
}

export type OwnedServiceKey = ApiKeyRecord & { actorUserId: string }

const keyColumns = {
  id: apikey.id,
  name: apikey.name,
  start: apikey.start,
  prefix: apikey.prefix,
  enabled: apikey.enabled,
  expiresAt: apikey.expiresAt,
  createdAt: apikey.createdAt,
  permissions: apikey.permissions,
  siteKey: sites.key,
}

export async function listOwnedServiceKeys(userId: string, db: BusinessDb = getBusinessDb()): Promise<ApiKeyRecord[]> {
  const rows = await db
    .select(keyColumns)
    .from(apikey)
    .leftJoin(apiKeySites, eq(apiKeySites.apiKeyId, apikey.id))
    .leftJoin(sites, eq(sites.id, apiKeySites.siteId))
    .where(eq(apikey.referenceId, userId))
    .orderBy(apikey.createdAt)
  return rows.map(toPluginKey)
}

export async function readServiceKey(keyId: string, db: BusinessDb = getBusinessDb()): Promise<OwnedServiceKey | null> {
  const [row] = await db
    .select({ ...keyColumns, actorUserId: apikey.referenceId })
    .from(apikey)
    .leftJoin(apiKeySites, eq(apiKeySites.apiKeyId, apikey.id))
    .leftJoin(sites, eq(sites.id, apiKeySites.siteId))
    .where(eq(apikey.id, keyId))
    .limit(1)
  return row ? { ...toPluginKey(row), actorUserId: row.actorUserId } : null
}

export async function updateServiceKeyValues(
  keyId: string,
  patch: { permissions?: Record<string, string[]>; enabled?: boolean },
  db: BusinessDb = getBusinessDb(),
): Promise<void> {
  await db
    .update(apikey)
    .set({
      ...(patch.permissions ? { permissions: JSON.stringify(patch.permissions) } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    })
    .where(eq(apikey.id, keyId))
}

export async function deleteServiceKey(keyId: string, db: BusinessDb = getBusinessDb()): Promise<void> {
  await db.delete(apikey).where(eq(apikey.id, keyId))
}
