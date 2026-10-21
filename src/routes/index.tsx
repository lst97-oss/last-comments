import { createFileRoute } from '@tanstack/react-router'

import { LandingContent } from '@/components/landing/landing-content'
import { LandingRail } from '@/components/landing/landing-rail'
import { listBlogPostsServerFn } from '@/lib/blog/server-fns'
import { SiteNotFound } from '@/lib/site-not-found'

export const Route = createFileRoute('/')({
  loader: async () => await listBlogPostsServerFn({ data: { limit: 3 } }),
  head: ({ loaderData }) => {
    const baseUrl = loaderData?.baseUrl?.replace(/\/+$/, '') ?? ''
    const canonical = baseUrl ? `${baseUrl}/` : '/'
    return {
      meta: [
        { title: 'Last Comments · Self-hosted comments for any site' },
        {
          name: 'description',
          content:
            'Self-hosted comment threads for any page: drop-in widgets for React, Vue, Angular and plain HTML, a moderation dashboard, votes, and a publisher API.',
        },
        { property: 'og:title', content: 'Last Comments · Self-hosted comments for any site' },
        {
          property: 'og:description',
          content:
            'Drop-in comment threads for any page: widgets for four frameworks, a moderation dashboard, votes, and a publisher API.',
        },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: canonical },
        { property: 'og:image', content: baseUrl ? `${baseUrl}/og-image.png` : '/og-image.png' },
        { name: 'twitter:title', content: 'Last Comments · Self-hosted comments for any site' },
        {
          name: 'twitter:description',
          content:
            'Drop-in comment threads for any page: widgets for four frameworks, a moderation dashboard, votes, and a publisher API.',
        },
        { name: 'twitter:image', content: baseUrl ? `${baseUrl}/og-image.png` : '/og-image.png' },
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
