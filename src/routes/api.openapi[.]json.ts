import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { openApiJsonResponse } from '@/server/openapi/reference'

// The `[.]` escape keeps the dot in the file name from becoming a path
// segment: without it the route would be /api/openapi/json.
export const Route = createFileRoute('/api/openapi.json')({
  server: {
    handlers: {
      // The handler builds a raw Response, so withContext passes it through
      // unwrapped — the document must not be nested in the `{ data }` envelope.
      GET: ({ request }) => withContext(async () => openApiJsonResponse(request))({ request }),
    },
  },
})
