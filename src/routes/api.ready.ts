import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { handleReadyGet } from '@/server/modules/health/http/health-handler'

// Readiness: DB-backed, 503 when degraded. handleReadyGet already builds the
// Response; withContext passes Responses through (id echo + logs only).
export const Route = createFileRoute('/api/ready')({
  server: {
    handlers: { GET: (ctx: { request: Request }) => withContext(() => handleReadyGet())(ctx) },
  },
})
