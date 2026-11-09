import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { notificationsTokenData } from '@/server/modules/admin/http/notifications-token'

// Dashboard admins only; every answer is a fresh credential, so nothing here may be cached.
export const Route = createFileRoute('/api/notifications-token')({
  server: {
    handlers: {
      GET: ({ request }) =>
        withContext(async ({ requestId }) => notificationsTokenData(request, undefined, { requestId }))({ request }),
    },
  },
})
