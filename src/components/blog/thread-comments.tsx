import { BlogComments } from '@/components/blog/blog-widgets'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useBlogThread } from '@/hooks/use-blog-thread'

import type { BlogCommentConfig } from '@/lib/blog/server-fns'

export function ThreadComments({
  config,
  pageUrl,
  pageKey,
}: {
  config: BlogCommentConfig
  pageUrl: string
  pageKey: string
}) {
  const { siteKey } = config
  const { commentCount, hasMore } = useBlogThread({
    site: siteKey,
    baseUrl: config.baseUrl,
    pageUrl,
    pageKey,
  })

  if (!siteKey) {
    return (
      <Alert>
        <AlertTitle>Comments are not configured</AlertTitle>
        <AlertDescription>
          Set <code>BLOG_SITE_KEY</code> to the site key created in /moderation, then reload this page.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <section aria-label="Comments" className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Comments</h2>
      {commentCount !== null && commentCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {`${commentCount}${hasMore ? '+' : ''} comment${commentCount === 1 && !hasMore ? '' : 's'}`}
        </p>
      )}
      <BlogComments
        baseUrl={config.baseUrl}
        pageUrl={pageUrl}
        site={siteKey}
        turnstileSiteKey={config.turnstileSiteKey ?? undefined}
        math
        mermaid
      />
    </section>
  )
}
