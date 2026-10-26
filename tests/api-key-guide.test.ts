import { describe, expect, test } from 'bun:test'
import { API_KEY_GUIDE_PATH, API_KEY_GUIDE_SITE_SECTION } from '@/lib/api-keys'

const ROOT = `${import.meta.dir}/..`

// Fumadocs ids a heading by its text: lower-cased, punctuation dropped, spaces turned into hyphens.
function headingId(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function headingIds(markdown: string): Set<string> {
  return new Set(
    markdown
      .split('\n')
      .filter((line) => /^#{2,3} /.test(line))
      .map((line) => headingId(line.replace(/^#+ /, ''))),
  )
}

describe('the API key guide', () => {
  test('the guide is in the docs navigation after the auth page', async () => {
    const meta = JSON.parse(await Bun.file(`${ROOT}/content/docs/meta.json`).text()) as { pages: string[] }
    expect(meta.pages.indexOf('api-keys')).toBe(meta.pages.indexOf('auth') + 1)
  })

  test('the API key dialog links to the guide', async () => {
    const dialog = await Bun.file(`${ROOT}/src/components/admin/api-key-dialog.tsx`).text()
    expect(dialog).toContain('href={API_KEY_GUIDE_PATH}')
  })

  test('the admin help links to a section that exists in the guide', async () => {
    const guide = await Bun.file(`${ROOT}/content/docs/api-keys.mdx`).text()
    expect(API_KEY_GUIDE_PATH).toBe('/docs/api-keys')
    expect(headingIds(guide)).toContain(API_KEY_GUIDE_SITE_SECTION)
  })

  test('every in-page link points at a heading in the guide', async () => {
    const guide = await Bun.file(`${ROOT}/content/docs/api-keys.mdx`).text()
    const headings = headingIds(guide)
    const links = [...guide.matchAll(/\]\(#([a-z0-9-]+)\)/g)].map((match) => match[1])
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) expect(headings.has(link)).toBe(true)
  })
})
