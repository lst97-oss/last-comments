import { createFileRoute } from '@tanstack/react-router'

import { buildSitemapXml, docsSitemapUrls, postsSitemapUrls, staticSitemapUrls } from '@/lib/seo/sitemap'
import { getServerEnv } from '@/server/env'
import { withContext } from '@/server/http/with-context'

// Dynamic sitemap: static public routes + every published blog post +
// every Fumadocs docs page. Posts are fail-open (a Payload outage still
// returns the static + docs entries with 200) so crawlers never see a 500.
async function sitemapXmlResponse(): Promise<Response> {
  const origin = getServerEnv().PAYLOAD_PUBLIC_SERVER_URL
  const urls = [...staticSitemapUrls(origin)]

  try {
    const { source } = await import('@/lib/docs/source')
    const docPaths = source.getPages().map((page) => page.url)
    urls.push(...docsSitemapUrls(origin, docPaths))
  } catch {
    urls.push(...docsSitemapUrls(origin, []))
  }

  try {
    const { default: config } = await import('@payload-config')
    const { getPayload } = await import('payload')
    const payload = await getPayload({ config })
    const { docs } = await payload.find({
      collection: 'posts',
      where: {
        and: [{ status: { equals: 'published' } }, { publishedAt: { less_than_equal: new Date() } }],
      },
      sort: '-publishedAt',
      limit: 1000,
      depth: 0,
    })
    urls.push(
      ...postsSitemapUrls(
        origin,
        docs.map((doc) => ({
          slug: typeof doc.slug === 'string' ? doc.slug : '',
          publishedAt: typeof doc.publishedAt === 'string' ? doc.publishedAt : null,
        })),
      ),
    )
  } catch {
    // Fail-open: keep the static + docs entries.
  }

  return new Response(buildSitemapXml(urls), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  })
}

// The `[.]` escape keeps the dot from becoming a path segment.
export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      // Raw Response: XML, not the `{ data }` envelope.
      GET: (ctx: { request: Request }) => withContext(async () => sitemapXmlResponse())(ctx),
    },
  },
})
