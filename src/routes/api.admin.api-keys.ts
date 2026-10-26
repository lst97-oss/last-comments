import { createFileRoute } from '@tanstack/react-router'

import { ErrorCode, HttpError } from '@/server/http/errors'
import { assertSameOrigin, getMembershipRole } from '@/server/http/route-guards'
import { parseJsonBody, parseSearchParams } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { requireDashboardUser } from '@/server/modules/admin/http/dashboard-guard'
import { hasInstanceAdmin } from '@/server/modules/admin/infrastructure/admin-repository'
import { createBodySchema, deleteQuerySchema, scopesBodySchema } from '@/server/modules/api-keys/http/api-key-schemas'
import {
  type ApiKeyScope,
  assertValidScopeSet,
  deleteServiceKey,
  issueServiceKey,
  listOwnedServiceKeys,
  readServiceKey,
  scopesToPermissions,
  updateServiceKeyValues,
} from '@/server/modules/api-keys/infrastructure/api-key-repository'
import { getSiteId } from '@/server/modules/comments/infrastructure/comment-repository'

async function requireSiteAdminId(userId: string, siteId: string): Promise<void> {
  if ((await getMembershipRole(siteId, userId)) !== 'admin') {
    throw new HttpError(
      ErrorCode.FORBIDDEN.status,
      ErrorCode.FORBIDDEN.code,
      'Only site admins can manage API keys for this site',
    )
  }
}

// Permissions + site binding are server-only in the plugin, so creation and
// scope updates go through this wrapper. Listing, reads, updates, and deletes
// run straight against our own apikey table (same storage format as the
// plugin) so dashboard users on any auth provider — not just the session
// cookie — can manage keys. Site-bound API keys always bind to exactly one site —
// create the site first, then mint its keys.

async function requireScopeManager(userId: string, siteKey: string | undefined): Promise<string | null> {
  if (!siteKey) {
    if (!(await hasInstanceAdmin(userId))) {
      throw new HttpError(
        ErrorCode.FORBIDDEN.status,
        ErrorCode.FORBIDDEN.code,
        'Only the instance admin can manage instance keys',
      )
    }
    return null
  }
  const siteId = await getSiteId(siteKey)
  await requireSiteAdminId(userId, siteId)
  return siteKey
}

// Key management is owner-scoped: callers see and change their own keys,
// instance admins additionally manage anyone's. The site binding must match
// so a key cannot be touched from outside its scope.
async function requireManagedKey(userId: string, keyId: string, siteKey: string | undefined) {
  const existing = await readServiceKey(keyId)
  const boundSiteKey = existing?.metadata?.site ?? null
  if (!existing || boundSiteKey !== (siteKey ?? null)) {
    throw new HttpError(ErrorCode.API_KEY_NOT_FOUND.status, ErrorCode.API_KEY_NOT_FOUND.code, 'API key was not found')
  }
  if (existing.actorUserId !== userId && !(await hasInstanceAdmin(userId))) {
    throw new HttpError(
      ErrorCode.FORBIDDEN.status,
      ErrorCode.FORBIDDEN.code,
      'Only the key owner can change this API key',
    )
  }
  return existing
}

export const Route = createFileRoute('/api/admin/api-keys')({
  server: {
    handlers: {
      GET: ({ request }) =>
        withContext(async () => {
          const userId = await requireDashboardUser(request, 'Sign in to manage API keys')
          return { keys: await listOwnedServiceKeys(userId) }
        })({ request }),
      POST: ({ request }) =>
        withContext(async () => {
          assertSameOrigin(request, 'API key management must use the application origin')
          const userId = await requireDashboardUser(request, 'Sign in to manage API keys')
          const body = await parseJsonBody(request, createBodySchema)
          const siteKey = await requireScopeManager(userId, body.siteKey)
          const key = await issueServiceKey({
            userId,
            name: body.name,
            siteKey,
            scopes: body.scopes as ApiKeyScope[],
            expiresIn: body.expiresIn,
          })
          return { key }
        })({ request }),
      PATCH: ({ request }) =>
        withContext(async () => {
          assertSameOrigin(request, 'API key management must use the application origin')
          const userId = await requireDashboardUser(request, 'Sign in to manage API keys')
          const body = await parseJsonBody(request, scopesBodySchema)
          await requireScopeManager(userId, body.siteKey)
          // Re-read the key to confirm it belongs to this scope before writing.
          await requireManagedKey(userId, body.keyId, body.siteKey)
          if (body.scopes === undefined && body.enabled === undefined) {
            throw new HttpError(
              ErrorCode.NOTHING_TO_UPDATE.status,
              ErrorCode.NOTHING_TO_UPDATE.code,
              'Pass scopes and/or enabled',
            )
          }
          if (body.scopes !== undefined) assertValidScopeSet(body.siteKey ?? null, body.scopes as ApiKeyScope[])
          await updateServiceKeyValues(body.keyId, {
            ...(body.scopes ? { permissions: scopesToPermissions(body.scopes as ApiKeyScope[]) } : {}),
            ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
          })
          return { updated: true }
        })({ request }),
      DELETE: ({ request }) =>
        withContext(async () => {
          assertSameOrigin(request, 'API key management must use the application origin')
          const userId = await requireDashboardUser(request, 'Sign in to manage API keys')
          const params = parseSearchParams(request.url, deleteQuerySchema)
          await requireScopeManager(userId, params.siteKey)
          await requireManagedKey(userId, params.keyId, params.siteKey)
          await deleteServiceKey(params.keyId)
          return { deleted: true }
        })({ request }),
    },
  },
})
