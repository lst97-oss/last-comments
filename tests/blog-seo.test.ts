import { describe, expect, test } from 'bun:test'

import {
  absoluteCoverUrl,
  absoluteUrl,
  buildBlogPostingJsonLd,
  postCanonicalUrl,
  postSeoDescription,
} from '@/lib/blog/blog-seo'

describe('absoluteUrl', () => {
  test('joins base and relative path without double slashes', () => {
    expect(absoluteUrl('https://example.com/', '/blog/hello')).toBe('https://example.com/blog/hello')
    expect(absoluteUrl('https://example.com', 'blog/hello')).toBe('https://example.com/blog/hello')
  })

  test('keeps absolute URLs untouched', () => {
    expect(absoluteUrl('https://example.com', 'https://cdn.example.com/cover.png')).toBe(
      'https://cdn.example.com/cover.png',
    )
  })
})

describe('postCanonicalUrl', () => {
  test('points at the post path', () => {
    expect(postCanonicalUrl('https://example.com', 'hello')).toBe('https://example.com/blog/hello')
  })
})

describe('postSeoDescription', () => {
  test('prefers the explicit description', () => {
    expect(postSeoDescription({ description: 'Custom summary.', content: '# Long body' })).toBe('Custom summary.')
  })

  test('falls back to stripped content excerpt', () => {
    const description = postSeoDescription({
      description: null,
      content: '# Hello\n\nThis is the **body** with a [link](https://example.com).',
    })
    expect(description).toBe('Hello This is the body with a link.')
  })

  test('falls back to a generic summary when content is empty', () => {
    expect(postSeoDescription({ description: null, content: '' })).toBe('A post on the Last Comments blog.')
  })

  test('truncates long excerpts', () => {
    const description = postSeoDescription({ description: null, content: `x`.repeat(500) })
    expect(description.length).toBeLessThanOrEqual(160)
    expect(description.endsWith('...')).toBe(true)
  })
})

describe('absoluteCoverUrl', () => {
  test('absolutizes relative upload URLs', () => {
    expect(absoluteCoverUrl('https://example.com', '/media/cover.png')).toBe('https://example.com/media/cover.png')
  })

  test('returns null when no cover', () => {
    expect(absoluteCoverUrl('https://example.com', null)).toBeNull()
  })
})

describe('buildBlogPostingJsonLd', () => {
  test('builds a BlogPosting node and omits missing fields', () => {
    const node = buildBlogPostingJsonLd(
      {
        slug: 'hello',
        title: 'Hello',
        description: null,
        content: '# Hello world',
        publishedAt: null,
        tags: [],
        coverUrl: null,
        authorName: null,
      },
      'https://example.com/blog/hello',
      null,
    )
    expect(node['@type']).toBe('BlogPosting')
    expect(node.mainEntityOfPage).toBe('https://example.com/blog/hello')
    expect(node).not.toHaveProperty('image')
    expect(node).not.toHaveProperty('datePublished')
  })

  test('includes image, author, date, and keywords when present', () => {
    const node = buildBlogPostingJsonLd(
      {
        slug: 'hello',
        title: 'Hello',
        description: 'Summary.',
        publishedAt: '2026-10-19T00:00:00.000Z',
        tags: ['a', 'b'],
        coverUrl: '/media/cover.png',
        authorName: 'Ada',
      },
      'https://example.com/blog/hello',
      'https://example.com/media/cover.png',
    )
    expect(node.image).toBe('https://example.com/media/cover.png')
    expect(node.datePublished).toBe('2026-10-19T00:00:00.000Z')
    expect(node.keywords).toBe('a, b')
  })
})
