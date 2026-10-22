import { createFileRoute, Link } from '@tanstack/react-router'

import { PostRow } from '@/components/blog/post-card'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { listBlogPostsServerFn } from '@/lib/blog/server-fns'
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, ogImageAlt, ogImageUrl } from '@/lib/seo/og-image'
import { SiteNotFound } from '@/lib/site-not-found'

const TITLE = 'Blog · Last Comments'
const DESCRIPTION =
  'Product notes and release write-ups for Last Comments, with the comment thread embedded on every post.'

export const Route = createFileRoute('/blog/')({
  loader: async () => await listBlogPostsServerFn({ data: {} }),
  head: ({ loaderData }) => {
    const baseUrl = loaderData?.baseUrl?.replace(/\/+$/, '') ?? ''
    const canonical = baseUrl ? `${baseUrl}/blog` : '/blog'
    const image = ogImageUrl(baseUrl, TITLE, DESCRIPTION)
    return {
      meta: [
        { title: TITLE },
        {
          name: 'description',
          content: DESCRIPTION,
        },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: canonical },
        { property: 'og:title', content: TITLE },
        { property: 'og:image', content: image },
        { property: 'og:image:alt', content: ogImageAlt(TITLE) },
        { property: 'og:image:width', content: String(OG_IMAGE_WIDTH) },
        { property: 'og:image:height', content: String(OG_IMAGE_HEIGHT) },
        { name: 'twitter:title', content: TITLE },
        { name: 'twitter:image', content: image },
      ],
      links: [{ rel: 'canonical', href: canonical }],
    }
  },
  component: BlogIndex,
  notFoundComponent: SiteNotFound,
})

function BlogIndex() {
  const { posts } = Route.useLoaderData()

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-4 text-foreground">
      <header className="flex flex-col gap-2 border-b border-border pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Blog</h1>
        <p className="text-sm text-muted-foreground">
          Notes on shipping comment threads, and the releases they ship in. Every post carries its own thread.
        </p>
      </header>

      {posts.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            No posts yet. Publish one from{' '}
            <Link className="underline" to="/admin">
              /admin
            </Link>{' '}
            — status <Badge variant="outline">published</Badge> and a past publish date put it on this page.
          </CardContent>
        </Card>
      ) : (
        <section aria-label="Posts" className="flex flex-col gap-4">
          {posts.map((post) => (
            <PostRow key={post.slug} post={post} />
          ))}
        </section>
      )}
    </main>
  )
}
