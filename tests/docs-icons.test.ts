import { describe, expect, test } from 'bun:test'

import { resolveDocIcon, withDocTreeIcons } from '@/lib/docs/icons'
import { serializeDocsPageTree } from '@/lib/docs/page-tree'

describe('docs sidebar icons', () => {
  test('resolves known names to elements and unknown names to nothing', () => {
    const known = resolveDocIcon('BookOpen') as { type?: { displayName?: string; name?: string } } | undefined
    expect(known?.type).toBeDefined()
    expect(known?.type?.displayName ?? known?.type?.name).toBe('BookOpen')
    expect(resolveDocIcon('NoSuchIcon')).toBeUndefined()
    expect(resolveDocIcon(undefined)).toBeUndefined()
  })

  test('serializer carries icon names as strings', () => {
    const tree = serializeDocsPageTree({
      name: 'Docs',
      children: [{ name: 'Install', url: '/docs/install', icon: 'Download' }],
    })
    expect(tree.data.children?.[0]).toMatchObject({ icon: 'Download' })
    expect(JSON.stringify(tree)).toContain('"icon":"Download"')
  })

  test('client mapping replaces names with elements, recursively', () => {
    const tree = withDocTreeIcons({
      name: 'Docs',
      children: [
        { name: 'Install', icon: 'Download', children: [{ name: 'React', icon: 'Bogus' }] },
        { name: 'Plain' },
      ],
    })
    const install = tree.children?.[0] as { icon?: { type?: { displayName?: string; name?: string } } }
    expect(install?.icon?.type).toBeDefined()
    expect(install?.icon?.type?.displayName ?? install?.icon?.type?.name).toBe('Download')
    // Unknown names and missing icons stay icon-less, never crash.
    expect(tree.children?.[0]?.children?.[0]).toMatchObject({ icon: undefined })
    expect(tree.children?.[1]).toMatchObject({ icon: undefined })
  })
})
