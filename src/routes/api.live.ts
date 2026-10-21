import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { getLiveData } from '@/server/modules/health/http/health-handler'

// Liveness: process-alive check only, never touches the database —
// orchestrators and Docker HEALTHCHECK hit this, never /api/ready.
export const Route = createFileRoute('/api/live')({
  server: {
    handlers: { GET: (ctx: { request: Request }) => withContext(async () => getLiveData())(ctx) },
  },
})
