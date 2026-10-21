import { eq } from 'drizzle-orm'

import { API_KEY_SCOPES, type ApiKeyScope } from '@/lib/api-key-scopes'
import type { PluginKey } from '@/lib/site-keys'
import { getBusinessAuth } from '@/server/auth/business-auth'
import { getBusinessDb } from '@/server/db/business-sql'
import { apikey } from '@/server/db/schema'
import { HttpError } from '@/server/http/errors'

export { API_KEY_SCOPES, type ApiKeyScope }

const SCOPE_TO_PERMISSION: Record<ApiKeyScope, { resource: string; action: string }> = {
  'sites:create': { resource: 'sites', action: 'create' },
  'sites:read': { resource: 'sites', action: 'read' },
  'sites:update': { resource: 'sites', action: 'update' },
  'sites:delete': { resource: 'sites', action: 'delete' },
  'pages:read': { resource: 'pages', action: 'read' },
  'pages:write': { resource: 'pages', action: 'write' },
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
      : (['pages:read', 'pages:write'] as const)
  if (scopes.length === 0 || !scopes.every((scope) => (allowed as readonly string[]).includes(scope))) {
    throw new HttpError(400, 'INVALID_SCOPE_SET', 'Scope set is not valid for this key type')
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

// Identity-only key inspection for the auth resolve layer: verifies the key
// without enforcing any scope. Routes still call requireServiceKey(scope)
// for authorization; resolvePrincipal never authorizes by itself.
export async function inspectServiceKey(request: Request): Promise<ResolvedServiceKey | null> {
  const secret = extractBearer(request)
  if (!secret) return null
  const auth = getBusinessAuth()
  const result = await auth.api.verifyApiKey({ body: { key: secret } })
  if (!result.valid || !result.key) return null
  const metadata = (result.key.metadata ?? {}) as { siteKey?: unknown }
  const boundSiteKey = typeof metadata.siteKey === 'string' ? metadata.siteKey : null
  return {
    id: result.key.id,
    siteKey: boundSiteKey,
    name: result.key.name,
    actorUserId: result.key.referenceId,
    scopes: permissionsToScopes(result.key.permissions),
  }
}

function extractBearer(request: Request): string | null {
  const raw = request.headers.get('x-api-key') ?? request.headers.get('authorization')
  if (!raw) return null
  if (raw.startsWith('Bearer ')) {
    const secret = raw.slice('Bearer '.length).trim()
    return secret ? secret : null
  }
  return raw
}

export function hasServiceKey(request: Request): boolean {
  return extractBearer(request) !== null
}

// Verify + permission-check in one call: plugin checks the permissions map,
// we check the site binding from metadata.
export async function requireServiceKey(
  request: Request,
  scope: ApiKeyScope,
  siteKey?: string,
): Promise<ResolvedServiceKey> {
  const secret = extractBearer(request)
  if (!secret) throw new HttpError(401, 'INVALID_API_KEY', 'API key is required')
  const { resource, action } = SCOPE_TO_PERMISSION[scope]
  const auth = getBusinessAuth()
  const result = await auth.api.verifyApiKey({ body: { key: secret, permissions: { [resource]: [action] } } })
  if (!result.valid || !result.key) {
    const code = result.error?.code
    if (code === 'KEY_NOT_FOUND')
      throw new HttpError(403, 'INSUFFICIENT_SCOPE', 'API key lacks the required permission')
    throw new HttpError(401, 'INVALID_API_KEY', 'API key is invalid, revoked, or expired')
  }
  const metadata = (result.key.metadata ?? {}) as { siteKey?: unknown }
  const boundSiteKey = typeof metadata.siteKey === 'string' ? metadata.siteKey : null
  if (boundSiteKey !== (siteKey ?? null)) {
    throw new HttpError(403, 'INSUFFICIENT_SCOPE', 'API key is not authorized for this site')
  }
  return {
    id: result.key.id,
    siteKey: boundSiteKey,
    name: result.key.name,
    actorUserId: result.key.referenceId,
    scopes: permissionsToScopes(result.key.permissions),
  }
}

// Server-side key issuance: permissions + site binding are set here, never
// from client input. Unbound keys hold sites:* (manage sites); site-bound keys
// hold pages:* for exactly one site (register and read its threads).
// Must run headerless: the plugin rejects server-only fields (permissions)
// whenever request headers are present.
export async function issueServiceKey(input: {
  userId: string
  name: string
  siteKey: string | null
  scopes: ApiKeyScope[]
  expiresIn?: number
}) {
  assertValidScopeSet(input.siteKey, input.scopes)
  const auth = getBusinessAuth()
  return auth.api.createApiKey({
    body: {
      userId: input.userId,
      name: input.name,
      prefix: 'lck_',
      metadata: input.siteKey ? { siteKey: input.siteKey } : {},
      permissions: scopesToPermissions(input.scopes),
      rateLimitEnabled: false,
      ...(input.expiresIn ? { expiresIn: input.expiresIn } : {}),
    },
  })
}

type BusinessDb = ReturnType<typeof getBusinessDb>

// Provider-neutral reads/writes straight against our own apikey table. The
// plugin's /api-key/* endpoints resolve the caller from a better-auth session
// cookie, so they cannot serve header/OIDC dashboard users; these helpers run
// under the route's own session guard instead. Storage format matches the
// plugin exactly (permissions as JSON text, metadata as JSON), so both paths
// see the same keys.
function parseKeyMetadata(metadata: unknown): { siteKey?: string } | null {
  let value = metadata
  while (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (typeof value !== 'object' || value === null) return null
  const record = value as { siteKey?: unknown }
  return typeof record.siteKey === 'string' ? { siteKey: record.siteKey } : null
}

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
  metadata: unknown
  permissions: string | null
}): PluginKey {
  return {
    id: row.id,
    name: row.name,
    start: row.start,
    prefix: row.prefix,
    enabled: row.enabled ?? true,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    metadata: parseKeyMetadata(row.metadata),
    permissions: parseKeyPermissions(row.permissions),
  }
}

export type OwnedServiceKey = PluginKey & { actorUserId: string }

export async function listOwnedServiceKeys(userId: string, db: BusinessDb = getBusinessDb()): Promise<PluginKey[]> {
  const rows = await db
    .select({
      id: apikey.id,
      name: apikey.name,
      start: apikey.start,
      prefix: apikey.prefix,
      enabled: apikey.enabled,
      expiresAt: apikey.expiresAt,
      createdAt: apikey.createdAt,
      metadata: apikey.metadata,
      permissions: apikey.permissions,
    })
    .from(apikey)
    .where(eq(apikey.referenceId, userId))
    .orderBy(apikey.createdAt)
  return rows.map(toPluginKey)
}

export async function readServiceKey(keyId: string, db: BusinessDb = getBusinessDb()): Promise<OwnedServiceKey | null> {
  const [row] = await db
    .select({
      id: apikey.id,
      name: apikey.name,
      start: apikey.start,
      prefix: apikey.prefix,
      enabled: apikey.enabled,
      expiresAt: apikey.expiresAt,
      createdAt: apikey.createdAt,
      metadata: apikey.metadata,
      permissions: apikey.permissions,
      actorUserId: apikey.referenceId,
    })
    .from(apikey)
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
      updatedAt: new Date(),
    })
    .where(eq(apikey.id, keyId))
}

export async function deleteServiceKey(keyId: string, db: BusinessDb = getBusinessDb()): Promise<void> {
  await db.delete(apikey).where(eq(apikey.id, keyId))
}
