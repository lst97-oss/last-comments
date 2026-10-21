import { cn } from 'cn'

import { Badge } from '@/components/ui/badge'

import type { BlogPostSummary } from '@/lib/blog/server-fns'

export function formatPostDate(publishedAt: string | null): string | null {
  if (!publishedAt) return null
  const date = new Date(publishedAt)
  if (Number.isNaN(date.getTime())) return null
  // Fixed locale on purpose: this renders during SSR and hydrates on the
  // client, so a locale-dependent format (`undefined`) mismatches whenever the
  // visitor's browser locale differs from the server's — React then discards
  // the server tree and regenerates, which races post-hydration DOM upgrades.
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function PostMeta({ post, className }: { post: BlogPostSummary; className?: string }) {
  const date = formatPostDate(post.publishedAt)
  return (
    <div className={cn('flex flex-col gap-1.5 text-xs text-muted-foreground', className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {date && <time dateTime={post.publishedAt ?? undefined}>{date}</time>}
        {post.authorName && <span>{post.authorName}</span>}
      </div>
      {post.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {post.tags.map((tag, index) => (
            <Badge key={`${tag}-${index}`} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
