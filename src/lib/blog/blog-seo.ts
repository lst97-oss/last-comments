export type SeoPostLike = {
  slug: string
  title: string
  description: string | null
  content?: string
  publishedAt: string | null
  tags: string[]
  coverUrl: string | null
  authorName: string | null
}

export function absoluteUrl(baseUrl: string, pathOrUrl: string): string {
  const value = pathOrUrl.trim()
  if (/^https?:\/\//i.test(value)) return value
  const base = baseUrl.replace(/\/+$/, '')
  const path = value.startsWith('/') ? value : `/${value}`
  return `${base}${path}`
}

export function postCanonicalUrl(baseUrl: string, slug: string): string {
  return absoluteUrl(baseUrl, `/blog/${slug}`)
}

function stripMarkdownToText(markdown: string): string {
  return markdown
    .replace(/^```[\s\S]*?^```/gm, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*_~]+/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function postSeoDescription(post: Pick<SeoPostLike, 'description' | 'content'>): string {
  const fallback = 'A post on the Last Comments blog.'
  const explicit = post.description?.trim()
  if (explicit) return explicit.length > 320 ? `${explicit.slice(0, 317)}...` : explicit
  const fromContent = post.content ? stripMarkdownToText(post.content) : ''
  if (!fromContent) return fallback
  return fromContent.length > 160 ? `${fromContent.slice(0, 157)}...` : fromContent
}

export function absoluteCoverUrl(baseUrl: string, coverUrl: string | null): string | null {
  if (!coverUrl) return null
  return absoluteUrl(baseUrl, coverUrl)
}

export function buildBlogPostingJsonLd(post: SeoPostLike, canonicalUrl: string, imageAbsolute: string | null) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: postSeoDescription(post),
    mainEntityOfPage: canonicalUrl,
    url: canonicalUrl,
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    ...(post.authorName ? { author: { '@type': 'Person', name: post.authorName } } : {}),
    ...(imageAbsolute ? { image: imageAbsolute } : {}),
    ...(post.tags.length > 0 ? { keywords: post.tags.join(', ') } : {}),
  }
}
