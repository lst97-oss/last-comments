import { describe, expect, test } from 'bun:test'

import { buildRobotsTxt } from '@/lib/seo/robots'

describe('buildRobotsTxt', () => {
  test('allows public surfaces and blocks app/admin/api paths', () => {
    const body = buildRobotsTxt('https://example.com/')
    expect(body).toContain('User-agent: *')
    expect(body).toContain('Allow: /')
    expect(body).toContain('Allow: /about')
    expect(body).toContain('Allow: /blog')
    expect(body).toContain('Allow: /docs')
    expect(body).toContain('Allow: /llms.txt')
    expect(body).toContain('Disallow: /admin')
    expect(body).toContain('Disallow: /api/')
    expect(body).toContain('Disallow: /dashboard')
    expect(body).toContain('Disallow: /moderation')
    expect(body).toContain('Disallow: /api-keys')
    expect(body).toContain('Disallow: /create-admin-user')
  })

  test('points crawlers at the absolute sitemap url', () => {
    expect(buildRobotsTxt('https://example.com///')).toContain('Sitemap: https://example.com/sitemap.xml')
  })
})
