import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { apiReferenceResponse } from '@/server/openapi/reference'

export const Route = createFileRoute('/api/reference')({
  server: {
    handlers: {
      // Raw Response: the Scalar page is HTML, not the `{ data }` envelope.
      GET: ({ request }) => withContext(async () => apiReferenceResponse(request))({ request }),
    },
  },
})
