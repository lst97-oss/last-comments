import { createFileRoute } from '@tanstack/react-router'

import { withContext } from '@/server/http/with-context'
import { handleOpenGraphImage } from '@/server/seo/open-graph-image'

// The card is a public, cacheable asset: it lives outside `/api/**` so the
// API route rules do not force `private, no-store` on it.
export const Route = createFileRoute('/og')({
  server: {
    handlers: {
      GET: (ctx: { request: Request }) => withContext(async () => handleOpenGraphImage(ctx.request.url))(ctx),
    },
  },
})
