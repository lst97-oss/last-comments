import { createFileRoute } from '@tanstack/react-router'
import { HttpError } from '@/server/http/errors'
import { assertSameOrigin, requireSessionUserId } from '@/server/http/route-guards'
import { parseJsonBody } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import { adminSiteSchema } from '@/server/modules/admin/http/admin-schemas'
import {
  createAdminSite,
  hasInstanceAdmin,
  listAdminSites,
  listAdminSitesForUser,
} from '@/server/modules/admin/infrastructure/admin-repository'
import { hasServiceKey, requireServiceKey } from '@/server/modules/api-keys/infrastructure/api-key-repository'

const SITE_MANAGEMENT_ORIGIN_MESSAGE = 'Site management must use the application origin'

// The session user the list is scoped to, or null for a service key (an
// instance-level key that may read every site).
async function requireSiteReader(request: Request): Promise<string | null> {
  if (hasServiceKey(request)) {
    await requireServiceKey(request, 'sites:read')
    return null
  }
  // Reads take no same-origin check: browsers omit Origin on same-origin GET,
  // and a cross-origin caller cannot read the JSON without CORS headers.
  return requireSessionUserId(request, 'Sign in to manage sites')
}

async function requireSiteCreator(request: Request): Promise<string | null> {
  if (hasServiceKey(request)) {
    await requireServiceKey(request, 'sites:create')
    return null
  }
  assertSameOrigin(request, SITE_MANAGEMENT_ORIGIN_MESSAGE)
  const userId = await requireSessionUserId(request, 'Sign in to manage sites')
  if (!(await hasInstanceAdmin(userId))) {
    throw new HttpError(403, 'FORBIDDEN', 'Only the instance admin can create sites')
  }
  return userId
}

export const Route = createFileRoute('/api/admin/sites')({
  server: {
    handlers: {
      // List the sites the caller may see: instance admins get every site, a
      // member only the sites they belong to. Service keys are
      // instance-level and keep the full list.
      GET: ({ request }) =>
        withContext(async () => {
          const userId = await requireSiteReader(request)
          if (userId === null || (await hasInstanceAdmin(userId))) {
            return { sites: await listAdminSites() }
          }
          return { sites: await listAdminSitesForUser(userId) }
        })({ request }),
      POST: ({ request }) =>
        withContext(async () => {
          // A service key with sites:create is a server caller: skip the
          // browser same-origin + session checks, permission check is the gate.
          const ownerUserId = await requireSiteCreator(request)
          const body = await parseJsonBody(request, adminSiteSchema)
          try {
            return { site: await createAdminSite(ownerUserId, body) }
          } catch (error) {
            if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
              throw new HttpError(409, 'SITE_KEY_EXISTS', 'A site with this key already exists')
            }
            throw error
          }
        })({ request }),
    },
  },
})
