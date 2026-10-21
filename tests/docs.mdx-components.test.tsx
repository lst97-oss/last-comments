import { describe, expect, test } from 'bun:test'
import React from 'react'

import { getMDXComponents } from '@/components/docs/mdx-components'

type AnchorProps = { href?: string; children?: React.ReactNode }
type AnchorComponent = (props: AnchorProps) => React.ReactElement

const Anchor = getMDXComponents().a as unknown as AnchorComponent

describe('docs mdx components', () => {
  // The API routes are server-only: they have no client component, so a
  // router navigation to one lands on the not-found page. Such links must
  // stay plain anchors, which the browser follows as a document request.
  // Both render the same markup, so the branch is checked on the element
  // the component returns.
  test('renders a link to an API route as a plain anchor', () => {
    expect(Anchor({ href: '/api/reference', children: 'x' }).type).toBe('a')
    expect(Anchor({ href: '/api/auth/reference', children: 'x' }).type).toBe('a')
  })

  test('keeps the router link for a page route', () => {
    expect(Anchor({ href: '/docs/install', children: 'x' }).type).not.toBe('a')
  })
})
