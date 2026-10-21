import { describe, expect, test } from 'bun:test'

import {
  absoluteSiteUrl,
  buildSitemapXml,
  docsSitemapUrls,
  normalizeOrigin,
  postsSitemapUrls,
  staticSitemapUrls,
} from '@/lib/seo/sitemap'

describe('normalizeOrigin', () => {
  test('strips trailing slashes', () => {
    expect(normalizeOrigin('https://example.com///')).toBe('https://example.com')
  })
})

describe('absoluteSiteUrl', () => {
  test('joins origin and path without double slashes', () => {
    expect(absoluteSiteUrl('https://example.com/', '/blog/hello')).toBe('https://example.com/blog/hello')
    expect(absoluteSiteUrl('https://example.com', 'blog/hello')).toBe('https://example.com/blog/hello')
  })
})

describe('staticSitemapUrls', () => {
  test('lists the landing page, the blog index and the about page', () => {
    const urls = staticSitemapUrls('https://example.com')
    expect(urls.map((url) => url.loc)).toEqual([
      'https://example.com/',
      'https://example.com/blog',
      'https://example.com/about',
    ])
  })
})

describe('docsSitemapUrls', () => {
  test('always includes the docs index and dedupes entries', () => {
    const urls = docsSitemapUrls('https://example.com', ['/docs/install', '/docs/install', '/admin'])
    expect(urls.map((url) => url.loc)).toEqual(['https://example.com/docs', 'https://example.com/docs/install'])
  })
})

describe('postsSitemapUrls', () => {
  test('maps slugs to blog urls with lastmod when present', () => {
    const urls = postsSitemapUrls('https://example.com', [
      { slug: 'hello', publishedAt: '2026-10-19T00:00:00.000Z' },
      { slug: 'draft', publishedAt: null },
      { slug: '  ', publishedAt: null },
    ])
    expect(urls).toHaveLength(2)
    expect(urls[0]?.loc).toBe('https://example.com/blog/hello')
    expect(urls[0]?.lastmod).toBe('2026-10-19T00:00:00.000Z')
    expect(urls[1]).not.toHaveProperty('lastmod')
  })
})

describe('buildSitemapXml', () => {
  test('escapes loc values and emits optional fields', () => {
    const xml = buildSitemapXml([
      { loc: 'https://example.com/?a=1&b=2', changefreq: 'daily', priority: 1 },
      { loc: 'https://example.com/blog/hello', lastmod: '2026-10-19T00:00:00.000Z' },
    ])
    expect(xml).toContain('&amp;')
    expect(xml).toContain('<changefreq>daily</changefreq>')
    expect(xml).toContain('<priority>1.0</priority>')
    expect(xml).toContain('<lastmod>2026-10-19T00:00:00.000Z</lastmod>')
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
  })
})
