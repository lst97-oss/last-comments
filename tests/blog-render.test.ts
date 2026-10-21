import { describe, expect, test } from 'bun:test'

import { splitBlogSegments } from '@/lib/blog/blog-render'

describe('splitBlogSegments', () => {
  test('returns a single markdown segment when no mermaid fence exists', () => {
    expect(splitBlogSegments('# Hello\n\nSome text.')).toEqual([{ kind: 'markdown', content: '# Hello\n\nSome text.' }])
  })

  test('splits mermaid fences into islands and keeps surrounding markdown', () => {
    const segments = splitBlogSegments('Before\n\n```mermaid\nflowchart LR\n  A --> B\n```\n\nAfter')
    expect(segments).toEqual([
      { kind: 'markdown', content: 'Before\n\n' },
      { kind: 'mermaid', content: 'flowchart LR\n  A --> B' },
      { kind: 'markdown', content: '\n\nAfter' },
    ])
  })

  test('handles multiple mermaid blocks in one post', () => {
    const segments = splitBlogSegments('```mermaid\nA\n```\nmid\n```mermaid\nB\n```')
    expect(segments.filter((segment) => segment.kind === 'mermaid')).toHaveLength(2)
    expect(segments[1]).toEqual({ kind: 'markdown', content: '\nmid\n' })
  })

  test('ignores non-mermaid fences', () => {
    const segments = splitBlogSegments('```tsx\nconst x = 1\n```')
    expect(segments).toEqual([{ kind: 'markdown', content: '```tsx\nconst x = 1\n```' }])
  })
})
