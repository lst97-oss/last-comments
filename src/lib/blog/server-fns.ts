import { createServerFn } from '@tanstack/react-start'
import type { Payload, Where } from 'payload'

import { getServerEnv } from '@/server/env'
import { getTurnstilePluginSettings } from '@/server/plugins/turnstile/turnstile.config'

// Blog reads go through Payload's local API. The config module is blocked in
// the client graph (vendor/payload-tanstack-vite/importProtection.js), so every
// handler imports it dynamically; payload caches the instance per config.
let payloadPromise: Promise<Payload> | null = null

async function getBlogPayload(): Promise<Payload> {
  payloadPromise ??= (async () => {
    // Dynamic on purpose: '@payload-config' is blocked in the client module
    // graph by vendor/payload-tanstack-vite/importProtection.js, and the
    // 'payload' runtime must not enter the client bundle — route components
    // import this module. Static imports cannot work here.
    const { default: config } = await import('@payload-config')
    const { getPayload } = await import('payload')
    return getPayload({ config })
  })()
  return payloadPromise
}

// Plain, serializable shape: Payload documents carry Date objects and
// relationship unions that must not cross the server-function boundary.
export type BlogPostSummary = {
  slug: string
  title: string
  description: string | null
  publishedAt: string | null
  tags: string[]
  coverUrl: string | null
  coverAlt: string | null
  authorName: string | null
}

export type BlogPost = BlogPostSummary & { content: string }

type PostDoc = {
  slug: string
  title: string
  description?: string | null
  content: string
  publishedAt?: string | null
  tags?: { value: string }[] | null
  cover?: number | { url?: string | null; alt?: string | null } | null
  authorName?: string | null
}

function toSummary(doc: PostDoc): BlogPostSummary {
  const cover = typeof doc.cover === 'object' ? doc.cover : null
  return {
    slug: doc.slug,
    title: doc.title,
    description: doc.description ?? null,
    publishedAt: doc.publishedAt ?? null,
    tags: (doc.tags ?? []).map((tag) => tag.value),
    coverUrl: cover?.url ?? null,
    coverAlt: cover?.alt ?? null,
    authorName: doc.authorName ?? null,
  }
}

function publishedWhere(): Where {
  return {
    and: [{ status: { equals: 'published' } }, { publishedAt: { less_than_equal: new Date() } }],
  }
}

export const listBlogPostsServerFn = createServerFn({ method: 'GET' })
  .validator((input: { limit?: number } | undefined) => input ?? {})
  .handler(async ({ data }): Promise<{ posts: BlogPostSummary[]; commentSiteKey: string | null; baseUrl: string }> => {
    const payload = await getBlogPayload()
    const { docs } = await payload.find({
      collection: 'posts',
      where: publishedWhere(),
      sort: '-publishedAt',
      limit: data.limit ?? 20,
      depth: 1,
    })
    const env = getServerEnv()
    return {
      posts: docs.map((doc) => toSummary(doc as PostDoc)),
      commentSiteKey: env.BLOG_SITE_KEY ?? null,
      baseUrl: env.PAYLOAD_PUBLIC_SERVER_URL,
    }
  })

export type BlogCommentConfig = {
  siteKey: string | null
  baseUrl: string
  turnstileSiteKey: string | null
}

// The widget needs the site key and base URL, and only the server knows both
// (origin-correct base URL, secret-free site key). Passing them as props keeps
// them out of a VITE_* variable that would duplicate the same value.
function commentConfig(): BlogCommentConfig {
  const env = getServerEnv()
  return {
    siteKey: env.BLOG_SITE_KEY ?? null,
    baseUrl: env.PAYLOAD_PUBLIC_SERVER_URL,
    turnstileSiteKey: getTurnstilePluginSettings().siteKey ?? null,
  }
}

export const blogPostServerFn = createServerFn({ method: 'GET' })
  .validator((input: { slug: string }) => input)
  .handler(async ({ data }): Promise<{ post: BlogPost | null; commentConfig: BlogCommentConfig }> => {
    const payload = await getBlogPayload()
    const { docs } = await payload.find({
      collection: 'posts',
      where: { and: [publishedWhere(), { slug: { equals: data.slug } }] },
      limit: 1,
      depth: 1,
    })
    const doc = docs[0]
    return {
      post: doc ? { ...toSummary(doc as PostDoc), content: doc.content } : null,
      commentConfig: commentConfig(),
    }
  })

// Ensures the comment thread exists for a published post. Server-side on
// purpose: the slug is re-checked here, so nothing a caller supplies can create
// a page for an unpublished or foreign URL, and no API key leaves the server.
export const ensureBlogThreadServerFn = createServerFn({ method: 'POST' })
  .validator((input: { slug: string }) => input)
  .handler(async ({ data }): Promise<{ created: boolean }> => {
    const env = getServerEnv()
    if (!env.BLOG_SITE_KEY) return { created: false }
    const payload = await getBlogPayload()
    const { docs } = await payload.find({
      collection: 'posts',
      where: { and: [publishedWhere(), { slug: { equals: data.slug } }] },
      limit: 1,
      depth: 0,
    })
    const doc = docs[0]
    if (!doc) return { created: false }
    // Same reason as getBlogPayload: src/server pulls pg and drizzle, which
    // must not enter the client graph.
    const { upsertPage } = await import('@/server/modules/comments/infrastructure/comment-repository')
    await upsertPage(env.BLOG_SITE_KEY, {
      url: `${env.PAYLOAD_PUBLIC_SERVER_URL}/blog/${doc.slug}`,
      pageKey: doc.slug,
      title: doc.title,
    })
    return { created: true }
  })
