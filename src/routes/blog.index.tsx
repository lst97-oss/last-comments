import { createFileRoute, Link } from '@tanstack/react-router'

import { PostRow } from '@/components/blog/post-card'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { listBlogPostsServerFn } from '@/lib/blog/server-fns'
import { SiteNotFound } from '@/lib/site-not-found'

export const Route = createFileRoute('/blog/')({
  loader: async () => await listBlogPostsServerFn({ data: {} }),
  head: ({ loaderData }) => {
    const baseUrl = loaderData?.baseUrl?.replace(/\/+$/, '') ?? ''
    const canonical = baseUrl ? `${baseUrl}/blog` : '/blog'
    const image = baseUrl ? `${baseUrl}/og-image.png` : '/og-image.png'
    return {
      meta: [
        { title: 'Blog · Last Comments' },
        {
          name: 'description',
          content:
            'Product notes and release write-ups for Last Comments, with the comment thread embedded on every post.',
        },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: canonical },
        { property: 'og:title', content: 'Blog · Last Comments' },
        { property: 'og:image', content: image },
        { name: 'twitter:title', content: 'Blog · Last Comments' },
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
