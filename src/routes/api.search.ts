import { createFileRoute } from '@tanstack/react-router'
import { createFromSource } from 'fumadocs-core/search/server'

import { source } from '@/lib/docs/source'

// Not wrapped in withContext on purpose: the Fumadocs search protocol expects
// the raw payload, not the `{ data }` envelope.
const server = createFromSource(source, { language: 'english' })

export const Route = createFileRoute('/api/search')({
  server: {
    handlers: {
      GET: async ({ request }) => server.GET(request),
    },
  },
})
