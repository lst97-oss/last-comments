import '@lst97-oss/last-comments-widgets/react/styles.css'

import { createFileRoute, Link, notFound } from '@tanstack/react-router'

import { BlogMarkdown } from '@/components/blog/blog-markdown'
import { PostMeta } from '@/components/blog/post-meta'
import { ThreadComments } from '@/components/blog/thread-comments'
import { absoluteCoverUrl, buildBlogPostingJsonLd, postCanonicalUrl, postSeoDescription } from '@/lib/blog/blog-seo'
import { blogPostServerFn } from '@/lib/blog/server-fns'
import { SiteNotFound } from '@/lib/site-not-found'

export const Route = createFileRoute('/blog/$slug')({
  loader: async ({ params }) => {
    const result = await blogPostServerFn({ data: { slug: params.slug } })
    if (!result.post) throw notFound()
    return { post: result.post, commentConfig: result.commentConfig }
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: 'Post · Last Comments' },
          { name: 'description', content: 'A post on the Last Comments blog.' },
        ],
      }
    }
    const { post, commentConfig } = loaderData
    const canonical = postCanonicalUrl(commentConfig.baseUrl, post.slug)
    const description = postSeoDescription(post)
    const cover = absoluteCoverUrl(commentConfig.baseUrl, post.coverUrl)
    const image = cover ?? absoluteCoverUrl(commentConfig.baseUrl, '/og-image.png')
    return {
      meta: [
        { title: `${post.title} · Last Comments` },
        { name: 'description', content: description },
        { property: 'og:type', content: 'article' },
        { property: 'og:url', content: canonical },
        { property: 'og:site_name', content: 'Last Comments' },
        { property: 'og:title', content: post.title },
        { property: 'og:description', content: description },
        ...(image ? [{ property: 'og:image', content: image }] : []),
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: post.title },
        { name: 'twitter:description', content: description },
        ...(image ? [{ name: 'twitter:image', content: image }] : []),
        ...(post.publishedAt ? [{ property: 'article:published_time', content: post.publishedAt }] : []),
        ...(post.authorName ? [{ property: 'article:author', content: post.authorName }] : []),
        {
          'script:ld+json': buildBlogPostingJsonLd(post, canonical, image),
        },
      ],
      links: [{ rel: 'canonical', href: canonical }],
    }
  },
  component: BlogPostPage,
  notFoundComponent: SiteNotFound,
})

function BlogPostPage() {
  const { post, commentConfig } = Route.useLoaderData()
  const pageUrl = `${commentConfig.baseUrl}/blog/${post.slug}`

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 p-4 text-foreground">
      <article className="flex flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-border pb-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link className="hover:text-foreground" to="/blog">
              Blog
            </Link>
            <span aria-hidden>/</span>
            <span aria-current="page" className="max-w-48 truncate text-foreground">
              {post.title}
            </span>
          </nav>
          <h1 className="text-3xl font-semibold tracking-tight">{post.title}</h1>
          {post.description && <p className="text-muted-foreground">{post.description}</p>}
          <PostMeta post={post} />
        </header>
        {post.coverUrl && (
          <img
            alt={post.coverAlt ?? ''}
            className="w-full rounded-xl border border-border object-cover"
            decoding="async"
            src={post.coverUrl}
          />
        )}
        <BlogMarkdown markdown={post.content} />
      </article>

      <div className="border-t border-border pt-6">
        <ThreadComments config={commentConfig} pageKey={post.slug} pageUrl={pageUrl} />
      </div>
    </main>
  )
}
