import { createFileRoute } from '@tanstack/react-router'

import { ErrorCode, HttpError } from '@/server/http/errors'
import { assertSameOrigin, getMembershipRole, requireSessionUserId } from '@/server/http/route-guards'
import { parseJsonBody, parseWith } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { siteKeyParamSchema, siteUpdateSchema } from '@/server/modules/admin/http/admin-schemas'
import {
  deleteAdminSite,
  findSiteIdByKey,
  hasInstanceAdmin,
  updateAdminSite,
} from '@/server/modules/admin/infrastructure/admin-repository'
import { hasServiceKey, requireServiceKey } from '@/server/modules/api-keys/infrastructure/api-key-repository'

// Dashboard editors are instance admins or site admins of the target site;
// service keys need sites:update / sites:delete respectively.
async function requireSiteWriter(
  request: Request,
  siteKey: string,
  scope: 'sites:update' | 'sites:delete',
): Promise<void> {
  if (hasServiceKey(request)) {
    // No site binding on purpose: only instance keys may carry sites:* scopes
    // (assertValidScopeSet rejects them on bound keys), so this is instance-only.
    await requireServiceKey(request, scope)
    return
  }
  assertSameOrigin(request, 'Site management must use the application origin')
  const userId = await requireSessionUserId(request, 'Sign in to manage sites')
  if (await hasInstanceAdmin(userId)) return
  // Unknown sites stay 403 here: a non-admin must not learn whether a key exists.
  const siteId = await findSiteIdByKey(siteKey)
  if (!siteId || (await getMembershipRole(siteId, userId)) !== 'admin') {
    throw new HttpError(ErrorCode.FORBIDDEN.status, ErrorCode.FORBIDDEN.code, 'Only site admins can edit this site')
  }
}

export const Route = createFileRoute('/api/admin/sites/$siteKey')({
  server: {
    handlers: {
      PATCH: ({ request, params }) =>
        withContext(async () => {
          const siteKey = parseWith(siteKeyParamSchema, params.siteKey)
          await requireSiteWriter(request, siteKey, 'sites:update')
          const body = await parseJsonBody(request, siteUpdateSchema)
          return { site: await updateAdminSite(siteKey, body) }
        })({ request }),
      DELETE: ({ request, params }) =>
        withContext(async () => {
          const siteKey = parseWith(siteKeyParamSchema, params.siteKey)
          await requireSiteWriter(request, siteKey, 'sites:delete')
          await deleteAdminSite(siteKey)
          return { deleted: true }
        })({ request }),
    },
  },
})
