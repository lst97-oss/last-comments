import { createFileRoute } from '@tanstack/react-router'

import { buildRobotsTxt } from '@/lib/seo/robots'
import { getServerEnv } from '@/server/env'
import { withContext } from '@/server/http/with-context'

function robotsTxtResponse(): Response {
  const origin = getServerEnv().PAYLOAD_PUBLIC_SERVER_URL
  return new Response(buildRobotsTxt(origin), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=86400',
    },
  })
}

// The `[.]` escape keeps the dot from becoming a path segment. This route
// replaces `public/robots.txt`: the Sitemap line needs the deployment origin,
// which a checked-in static file cannot know.
export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      // Raw Response: plain text, not the `{ data }` envelope.
      GET: (ctx: { request: Request }) => withContext(async () => robotsTxtResponse())(ctx),
    },
  },
})
