import { describe, expect, test } from 'bun:test'
import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { renderToString } from 'react-dom/server'
import React from 'react'

import { SiteError } from '@/lib/site-error'

// Boundary proof: a throwing loader renders SiteError (not TanStack default
// chrome) with the message and recovery actions. Router registration
// (defaultErrorComponent: SiteError in src/router.tsx) is the same component,
// verified live by the smoke run.
async function renderThrowingRoute(error: unknown): Promise<string> {
  const rootRoute = createRootRoute()
  const boomRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/boom',
    loader: () => {
      throw error
    },
    errorComponent: SiteError,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([boomRoute]),
    history: createMemoryHistory({ initialEntries: ['/boom'] }),
  })
  await router.load()
  try {
    return renderToString(React.createElement(RouterProvider, { router }))
  } finally {
    router.history.destroy()
  }
}

describe('SiteError', () => {
  test('shows the thrown message with recovery actions', async () => {
    const html = await renderThrowingRoute(new Error('loader blew up'))
    expect(html).toContain('loader blew up')
    expect(html).toContain('Try again')
    expect(html).toContain('Go home')
  })

  test('non-Error values get the generic message', async () => {
    const html = await renderThrowingRoute('boom')
    expect(html).toContain('Something went wrong.')
  })
})
