import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

import { PostCard } from '@/components/blog/post-card'
import { LandingFrameworkSection } from '@/components/landing/landing-framework-section'
import { LandingInstallTabs } from '@/components/landing/landing-install-tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

import type { BlogPostSummary } from '@/lib/blog/server-fns'

const FEATURES = [
  {
    number: '01',
    title: 'Works with your stack.',
    description:
      'React, Vue, Angular and plain HTML share one API client and one theme. Register a page origin and comments work on any URL.',
    tags: ['React', 'Vue', 'Angular', 'HTML'],
  },
  {
    number: '02',
    title: 'Guests and signed-in authors.',
    description:
      'Guests post with a display name and an optional Turnstile token. Signed-in users post through a Better Auth session.',
    tags: ['Guest', 'Signed-in'],
  },
  {
    number: '03',
    title: 'Votes with viewer state.',
    description:
      'Every comment carries its score and the viewer’s own vote, so a thread renders correctly for each reader.',
    tags: ['score', 'viewerVote'],
  },
  {
    number: '04',
    title: 'Moderation dashboard.',
    description:
      'Hide, restore, pin, delete and lock pages from /moderation, with block-by-user, moderator replies and a per-page thread view.',
    tags: ['hide', 'pin', 'lock'],
  },
  {
    number: '05',
    title: 'Publisher API.',
    description:
      'Site-bound API keys register page threads up front, so a publishing pipeline can claim a page key before the first comment lands.',
    tags: ['POST /api/admin/pages'],
  },
  {
    number: '06',
    title: 'Plugin system.',
    description:
      'Server-side plugins hook validation, operations and transactional events. Rate limiting and Turnstile ship enabled.',
    tags: ['rate-limit', 'turnstile'],
  },
] as const

export function LandingContent({ posts }: { posts: BlogPostSummary[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-12 py-8">
      <section className="flex flex-col gap-3 scroll-mt-8" id="readme">
        <h2 className="text-sm font-semibold tracking-wide uppercase">README</h2>
        <Separator />
        <p className="max-w-3xl text-muted-foreground">
          Comments that live inside your stack. Drop-in threads, moderation and a publisher API — self-hosted on your
          own Postgres, from weekend blogs to production publishers.
        </p>
      </section>

      <section className="flex flex-col gap-4 scroll-mt-8" id="install">
        <LandingInstallTabs />
      </section>

      <section aria-label="Features" className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold tracking-wide uppercase">Features</h2>
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 xl:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.number} className="flex flex-col gap-2 bg-background p-5">
              <span className="font-mono text-xs text-muted-foreground">{feature.number}</span>
              <h3 className="font-semibold tracking-tight">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {feature.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <LandingFrameworkSection />

      <section aria-label="Latest posts" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase">Latest posts</h2>
          <Link
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            to="/blog"
          >
            View all
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </div>
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No posts published yet — publish one from /admin and it appears here.
          </p>
        ) : (
          <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
