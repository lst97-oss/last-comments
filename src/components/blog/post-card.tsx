import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

import { PostMeta } from '@/components/blog/post-meta'
import { Card } from '@/components/ui/card'

import type { BlogPostSummary } from '@/lib/blog/server-fns'

function ReadMore() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
      Read
      <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
    </span>
  )
}

export function PostCard({ post }: { post: BlogPostSummary }) {
  return (
    <Card className="group relative h-full transition-colors hover:border-foreground/25 hover:shadow-sm">
      {post.coverUrl && (
        <img
          alt={post.coverAlt ?? ''}
          className="aspect-[16/9] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          decoding="async"
          loading="lazy"
          src={post.coverUrl}
        />
      )}
      <div className="flex flex-1 flex-col gap-2.5 px-(--card-spacing) py-1">
        <PostMeta post={post} />
        <h3 className="text-lg leading-snug font-semibold tracking-tight">
          <Link
            className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring group-hover:underline group-hover:underline-offset-4"
            params={{ slug: post.slug }}
            to="/blog/$slug"
          >
            {post.title}
          </Link>
        </h3>
        {post.description && <p className="line-clamp-3 text-sm text-muted-foreground">{post.description}</p>}
        <div className="mt-auto flex items-center justify-end gap-2 pt-1">
          <ReadMore />
        </div>
      </div>
    </Card>
  )
}

export function PostRow({ post }: { post: BlogPostSummary }) {
  return (
    <article className="group relative flex gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/25 hover:shadow-sm sm:gap-6 sm:p-6">
      {post.coverUrl && (
        <img
          alt={post.coverAlt ?? ''}
          className="hidden aspect-[4/3] w-40 shrink-0 self-start rounded-lg border border-border object-cover sm:block"
          decoding="async"
          loading="lazy"
          src={post.coverUrl}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <PostMeta post={post} />
        <h2 className="text-xl leading-snug font-semibold tracking-tight">
          <Link
            className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring group-hover:underline group-hover:underline-offset-4"
            params={{ slug: post.slug }}
            to="/blog/$slug"
          >
            {post.title}
          </Link>
        </h2>
        {post.description && <p className="line-clamp-2 text-sm text-muted-foreground">{post.description}</p>}
      </div>
      <ArrowRight
        aria-hidden
        className="mt-1 size-5 shrink-0 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-foreground"
      />
    </article>
  )
}
