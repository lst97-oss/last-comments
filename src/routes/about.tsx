import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

import { AboutContent } from '@/components/landing/about-content'
import { LandingRail } from '@/components/landing/landing-rail'
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, ogImageAlt, ogImageUrl } from '@/lib/seo/og-image'
import { GITHUB_URL } from '@/lib/site-links'

const TITLE = 'About Last Comments · Universal self-hosted comment system'
const DESCRIPTION =
  'Last Comments is a universal, self-hosted comment system: one secure core for every site, minimal by default, extended through plugins and themed to match any design.'

// Only the deployment origin is needed for canonical and OG URLs, so the page
// stays independent of the content database.
const originServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  // Dynamic on purpose: a top-level import of the server env module in a
  // route file lands in the client bundle.
  const { getServerEnv } = await import('@/server/env')
  return { baseUrl: getServerEnv().PAYLOAD_PUBLIC_SERVER_URL.replace(/\/+$/, '') }
})

export const Route = createFileRoute('/about')({
  loader: async () => await originServerFn(),
  head: ({ loaderData }) => {
    const baseUrl = loaderData?.baseUrl ?? ''
    const canonical = baseUrl ? `${baseUrl}/about` : '/about'
    const image = ogImageUrl(baseUrl, TITLE, DESCRIPTION)
    return {
      meta: [
        { title: TITLE },
        { name: 'description', content: DESCRIPTION },
        { property: 'og:title', content: TITLE },
        { property: 'og:description', content: DESCRIPTION },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: canonical },
        { property: 'og:image', content: image },
        { property: 'og:image:alt', content: ogImageAlt(TITLE) },
        { property: 'og:image:width', content: String(OG_IMAGE_WIDTH) },
        { property: 'og:image:height', content: String(OG_IMAGE_HEIGHT) },
        { name: 'twitter:title', content: TITLE },
        { name: 'twitter:description', content: DESCRIPTION },
        { name: 'twitter:image', content: image },
        {
          'script:ld+json': {
            '@context': 'https://schema.org',
            '@type': 'AboutPage',
            name: 'About Last Comments',
            url: canonical,
            description: DESCRIPTION,
            mainEntity: {
              '@type': 'Organization',
              name: 'Last Comments',
              ...(baseUrl ? { url: baseUrl } : {}),
              description: 'Universal, self-hosted comment system for any site.',
              sameAs: [GITHUB_URL],
            },
          },
        },
      ],
      links: [{ rel: 'canonical', href: canonical }],
    }
  },
  component: AboutPage,
})

function AboutPage() {
  return (
    <main className="mx-auto grid w-full max-w-[1400px] flex-1 gap-8 px-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
      <LandingRail headingAs="h2" />
      <AboutContent />
    </main>
  )
}
