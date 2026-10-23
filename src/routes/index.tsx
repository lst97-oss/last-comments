import { createFileRoute } from '@tanstack/react-router'

import { LandingContent } from '@/components/landing/landing-content'
import { LandingRail } from '@/components/landing/landing-rail'
import { listBlogPostsServerFn } from '@/lib/blog/server-fns'
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, ogImageAlt, ogImageUrl } from '@/lib/seo/og-image'
import { SiteNotFound } from '@/lib/site-not-found'

const TITLE = 'Last Comments · Self-hosted comments for any site'
const OG_DESCRIPTION =
  'Drop-in comment threads for any page: widgets for four frameworks, a moderation dashboard, votes, and a publisher API.'

export const Route = createFileRoute('/')({
  loader: async () => await listBlogPostsServerFn({ data: { limit: 3 } }),
  head: ({ loaderData }) => {
    const baseUrl = loaderData?.baseUrl?.replace(/\/+$/, '') ?? ''
    const canonical = baseUrl ? `${baseUrl}/` : '/'
    const image = ogImageUrl(baseUrl, TITLE, OG_DESCRIPTION)
    return {
      meta: [
        { title: TITLE },
        {
          name: 'description',
          content:
            'Self-hosted comment threads for any page: drop-in widgets for React, Vue, Angular and plain HTML, a moderation dashboard, votes, and a publisher API.',
        },
        { property: 'og:title', content: TITLE },
        {
          property: 'og:description',
          content: OG_DESCRIPTION,
        },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: canonical },
        { property: 'og:image', content: image },
        { property: 'og:image:alt', content: ogImageAlt(TITLE) },
        { property: 'og:image:width', content: String(OG_IMAGE_WIDTH) },
        { property: 'og:image:height', content: String(OG_IMAGE_HEIGHT) },
        { name: 'twitter:title', content: TITLE },
        {
          name: 'twitter:description',
          content: OG_DESCRIPTION,
        },
        { name: 'twitter:image', content: image },
        {
          'script:ld+json': {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Last Comments',
            url: canonical,
            description:
              'Self-hosted comment threads for any page: drop-in widgets, a moderation dashboard, votes, and a publisher API.',
          },
        },
      ],
      links: [{ rel: 'canonical', href: canonical }],
    }
  },
  component: Index,
  notFoundComponent: SiteNotFound,
})

function Index() {
  const { posts } = Route.useLoaderData()

  return (
    <main className="mx-auto grid w-full max-w-[1400px] flex-1 gap-8 px-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
      <LandingRail />
      <LandingContent posts={posts} />
    </main>
  )
}
