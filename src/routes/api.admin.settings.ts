import { createFileRoute } from '@tanstack/react-router'

import { ErrorCode, HttpError } from '@/server/http/errors'
import { requireSessionUserId } from '@/server/http/route-guards'
import { withContext } from '@/server/http/with-context'
import { hasInstanceAdmin } from '@/server/modules/admin/infrastructure/admin-repository'
import { getInstanceSettings } from '@/server/modules/admin/infrastructure/settings'

// Session-only and instance-admin-only: the snapshot describes the whole
// instance (providers, plugin status), not one site, and carries no secrets
// — only whether each one is configured.
export const Route = createFileRoute('/api/admin/settings')({
  server: {
    handlers: {
      GET: ({ request }) =>
        withContext(async () => {
          const userId = await requireSessionUserId(request, 'Sign in to view settings')
          if (!(await hasInstanceAdmin(userId))) {
            throw new HttpError(
              ErrorCode.FORBIDDEN.status,
              ErrorCode.FORBIDDEN.code,
              'Settings are restricted to administrators',
            )
          }
          return getInstanceSettings()
        })({ request }),
    },
  },
})
