import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { notificationsConfigData } from '@/server/modules/admin/http/notifications-config'

// Dashboard admins only. It carries no credential, but it is still per admin, so nothing here may be cached.
export const Route = createFileRoute('/api/notifications-config')({
  server: {
    handlers: {
      GET: ({ request }) => withContext(async () => notificationsConfigData(request))({ request }),
    },
  },
})
