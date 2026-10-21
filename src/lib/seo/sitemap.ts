export type SitemapChangefreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'

export type SitemapUrl = {
  loc: string
  lastmod?: string
  changefreq?: SitemapChangefreq
  priority?: number
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, '')
}

export function absoluteSiteUrl(origin: string, path: string): string {
  const base = normalizeOrigin(origin.trim())
  const suffix = path.startsWith('/') ? path : `/${path}`
  return `${base}${suffix}`
}

function staticSitemapEntries(): Array<Omit<SitemapUrl, 'loc'> & { path: string }> {
  return [
    { path: '/', changefreq: 'daily', priority: 1 },
    { path: '/blog', changefreq: 'daily', priority: 0.8 },
    { path: '/about', changefreq: 'monthly', priority: 0.5 },
  ]
}

export function staticSitemapUrls(origin: string): SitemapUrl[] {
  return staticSitemapEntries().map(({ path, ...rest }) => ({
    ...rest,
    loc: absoluteSiteUrl(origin, path),
  }))
}

export function docsSitemapUrls(origin: string, docPaths: string[]): SitemapUrl[] {
  const seen = new Set<string>()
  const urls: SitemapUrl[] = []
  for (const path of ['/docs', ...docPaths]) {
    const normalized = path === '/' ? '/docs' : path
    if (!normalized.startsWith('/docs')) continue
    if (seen.has(normalized)) continue
    seen.add(normalized)
    urls.push({
      loc: absoluteSiteUrl(origin, normalized),
      changefreq: 'weekly',
      priority: normalized === '/docs' ? 0.8 : 0.6,
    })
  }
  return urls
}

export function postsSitemapUrls(
  origin: string,
  posts: Array<{ slug: string; publishedAt: string | null }>,
): SitemapUrl[] {
  return posts
    .map((post) => post.slug.trim())
    .filter((slug) => slug.length > 0)
    .map((slug) => {
      const match = posts.find((post) => post.slug.trim() === slug)
      const entry: SitemapUrl = {
        loc: absoluteSiteUrl(origin, `/blog/${slug}`),
        changefreq: 'weekly',
        priority: 0.7,
      }
      if (match?.publishedAt) entry.lastmod = match.publishedAt
      return entry
    })
}

export function buildSitemapXml(urls: SitemapUrl[]): string {
  const entries = urls
    .map((url) => {
      const lines = [`    <loc>${escapeXml(url.loc)}</loc>`]
      if (url.lastmod) lines.push(`    <lastmod>${escapeXml(url.lastmod)}</lastmod>`)
      if (url.changefreq) lines.push(`    <changefreq>${url.changefreq}</changefreq>`)
      if (typeof url.priority === 'number') lines.push(`    <priority>${url.priority.toFixed(1)}</priority>`)
      return `  <url>\n${lines.join('\n')}\n  </url>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`
}
