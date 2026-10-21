import { normalizeOrigin } from '@/lib/seo/sitemap'

const DISALLOWED_PATHS = ['/admin', '/api/', '/dashboard', '/moderation', '/api-keys', '/create-admin-user'] as const

const ALLOWED_PATHS = ['/', '/about', '/blog', '/docs', '/llms.txt'] as const

export function buildRobotsTxt(origin: string): string {
  const base = normalizeOrigin(origin.trim())
  const lines = [
    'User-agent: *',
    ...ALLOWED_PATHS.map((path) => `Allow: ${path}`),
    ...DISALLOWED_PATHS.map((path) => `Disallow: ${path}`),
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ]
  return `${lines.join('\n')}`
}
