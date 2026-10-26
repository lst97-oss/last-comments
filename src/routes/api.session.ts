import { createFileRoute } from '@tanstack/react-router'

import { resolveSessionPrincipal } from '@/server/auth/resolve'
import { withContext } from '@/server/http/with-context'
import { hasDashboardAccess } from '@/server/modules/admin/infrastructure/dashboard-access'

// Provider-neutral session probe for the dashboard UI. Unlike the better-auth
// client (which speaks only to /api/auth/*), this resolves through every
// enabled provider — session cookie, OIDC bearer, or proxy headers — so the
// sign-in UI gates on the same identity the API routes enforce. `dashboard`
// says whether that identity may use the dashboard: admins only.
export const Route = createFileRoute('/api/session')({
  server: {
    handlers: {
      GET: ({ request }) =>
        withContext(async () => {
          const principal = await resolveSessionPrincipal(request)
          return {
            principal: principal
              ? {
                  userId: principal.userId,
                  email: principal.email,
                  displayName: principal.displayName,
                  provider: principal.credential.kind === 'session' ? 'better-auth' : principal.credential.provider,
                }
              : null,
            dashboard: principal ? await hasDashboardAccess(principal.userId) : false,
          }
        })({ request }),
    },
  },
})
