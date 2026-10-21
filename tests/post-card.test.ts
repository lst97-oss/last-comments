import { describe, expect, test } from 'bun:test'
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { renderToString } from 'react-dom/server'
import React from 'react'

import { PostCard, PostRow } from '@/components/blog/post-card'

import type { BlogPostSummary } from '@/lib/blog/server-fns'

const basePost: BlogPostSummary = {
  slug: 'hello-world',
  title: 'Hello world',
  description: 'First post.',
  publishedAt: '2026-10-19T12:00:00.000Z',
  tags: ['a', 'b', 'c', 'd', 'e'],
  coverUrl: null,
  coverAlt: null,
  authorName: 'Ada',
}

async function renderWithRouter(ui: React.ReactNode): Promise<string> {
  const rootRoute = createRootRoute({ component: () => ui })
  const router = createRouter({ routeTree: rootRoute, history: createMemoryHistory({ initialEntries: ['/'] }) })
  await router.load()
  try {
    return renderToString(React.createElement(RouterProvider, { router }))
  } finally {
    router.history.destroy()
  }
}

describe('PostCard', () => {
  test('links the title to the post with meta and description', async () => {
    const html = await renderWithRouter(React.createElement(PostCard, { post: basePost }))
    expect(html).toContain('Hello world')
    expect(html).toContain('href="/blog/hello-world"')
    expect(html).toContain('First post.')
    expect(html).toContain('Oct 19, 2026')
    expect(html).toContain('Read')
  })

  test('renders all tags and no cover image when absent', async () => {
    const html = await renderWithRouter(React.createElement(PostCard, { post: basePost }))
    for (const tag of basePost.tags) expect(html).toContain(tag)
    expect(html).not.toContain('<img')
  })

  test('renders the cover image when present', async () => {
    const html = await renderWithRouter(
      React.createElement(PostCard, {
        post: { ...basePost, coverUrl: 'https://cdn.example/cover.jpg', coverAlt: 'Cover' },
      }),
    )
    expect(html).toContain('src="https://cdn.example/cover.jpg"')
    expect(html).toContain('alt="Cover"')
  })
})

describe('PostRow', () => {
  test('links the title to the post with clamped description', async () => {
    const html = await renderWithRouter(React.createElement(PostRow, { post: basePost }))
    expect(html).toContain('Hello world')
    expect(html).toContain('href="/blog/hello-world"')
    expect(html).toContain('First post.')
  })
})
