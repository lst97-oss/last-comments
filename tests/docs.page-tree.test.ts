import { describe, expect, test } from 'bun:test'

import { serializeDocsPageTree } from '@/lib/docs/page-tree'

// A React element carries a cyclic `_owner` fiber, which is why the tree
// cannot be handed to the client as it is.
function elementWithOwner(html: string) {
  const owner: Record<string, unknown> = { parent: null }
  owner.parent = owner
  return { type: 'span', props: { dangerouslySetInnerHTML: { __html: html } }, _owner: owner }
}

describe('docs page tree', () => {
  test('copies the tree with serializable names', () => {
    const tree = {
      name: 'Docs',
      type: 'root',
      children: [
        { name: 'Install', type: 'page', url: '/docs/install' },
        { name: 'Widgets', type: 'folder', children: [{ name: 'React', type: 'page', url: '/docs/widgets/react' }] },
      ],
    }

    const serialized = serializeDocsPageTree(tree)

    expect(serialized.$fumadocs_loader).toBe('page-tree')
    expect(serialized.data.name).toBe('Docs')
    expect(serialized.data.children?.[0]?.url).toBe('/docs/install')
    expect(serialized.data.children?.[1]?.children?.[0]?.name).toBe('React')
  })

  test('reduces a React element name back to its text', () => {
    const serialized = serializeDocsPageTree({ name: 'Docs', children: [{ name: elementWithOwner('React') }] })

    expect(serialized.data.children?.[0]?.name).toBe('React')
  })

  test('produces a body that survives JSON serialization', () => {
    const tree = {
      name: 'Docs',
      children: [{ name: elementWithOwner('React'), url: '/docs/widgets/react' }],
    }

    const serialized = serializeDocsPageTree(tree)

    expect(() => JSON.stringify(serialized)).not.toThrow()
    expect(JSON.parse(JSON.stringify(serialized)).data.children[0].name).toBe('React')
  })
})
