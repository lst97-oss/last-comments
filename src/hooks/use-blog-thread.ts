import { listCommentsPage } from '@lst97-oss/last-comments-widgets/client'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'

import { ensureBlogThreadServerFn } from '@/lib/blog/server-fns'

// Threads are registered server-side when a post is published; this hook is the
// page-side safety net for posts that predate the publisher key (or a failed
// registration). It reads the thread through the widget client and only asks
// the server to create it when the page genuinely has none.
const ensuredThreads = new Set<string>()

export type BlogThreadOptions = {
  site: string | null
  baseUrl: string
  pageUrl: string
  /** Stable thread key: the post slug. Matches the published-post hook. */
  pageKey: string
}

export function useBlogThread({ site, baseUrl, pageUrl, pageKey }: BlogThreadOptions) {
  const enabled = Boolean(site)
  const query = useQuery({
    queryKey: ['blog-thread', site, baseUrl, pageUrl],
    enabled,
    queryFn: async () => {
      const page = await listCommentsPage({ site: site as string, baseUrl, pageUrl })
      return { commentCount: page.comments.length, hasMore: page.hasMore }
    },
  })

  const hasThread = (query.data?.commentCount ?? 0) > 0 || Boolean(query.data?.hasMore)
  useEffect(() => {
    // Only a successful read that found no thread may ask the server to
    // create one; a failed read says nothing about the thread's existence.
    if (!enabled || !query.isSuccess || hasThread || ensuredThreads.has(pageKey)) return
    ensuredThreads.add(pageKey)
    // Fire-and-forget: a failure here only means the thread appears on the
    // first comment instead, which the comment API already supports. A
    // failed call releases the key again so a later mount can retry.
    void ensureBlogThreadServerFn({ data: { slug: pageKey } }).catch(() => {
      ensuredThreads.delete(pageKey)
    })
  }, [enabled, hasThread, pageKey, query.isSuccess])

  return {
    commentCount: query.data?.commentCount ?? null,
    hasMore: query.data?.hasMore ?? false,
  }
}
