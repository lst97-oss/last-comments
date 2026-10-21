import { describe, expect, test } from 'bun:test'

// Guards the agent-readable site file: it must name the product, point at the
// docs/API surfaces, and keep the HTTP path table in sync with the reference.
const llmsPath = `${import.meta.dir}/../public/llms.txt`

describe('public llms.txt', () => {
  test('covers what-it-is, docs, api, and examples', async () => {
    const body = await Bun.file(llmsPath).text()
    expect(body).toContain('# Last Comments')
    for (const heading of ['## What this site is', '## Docs', '## HTTP API', '## Examples']) {
      expect(body).toContain(heading)
    }
  })

  test('links the docs index, openapi document, scalar pages, sitemap, and robots', async () => {
    const body = await Bun.file(llmsPath).text()
    for (const link of [
      '/docs/install',
      '/api/openapi.json',
      '/api/reference',
      '/api/auth/reference',
      '/sitemap.xml',
      '/robots.txt',
    ]) {
      expect(body).toContain(link)
    }
  })

  test('documents every publisher path from the api reference', async () => {
    const body = await Bun.file(llmsPath).text()
    for (const path of [
      '/api/comments',
      '/api/comments/{commentId}',
      '/api/comments/vote',
      '/api/moderation',
      '/api/admin/sites',
      '/api/admin/pages',
      '/api/admin/stats',
      '/api/admin/api-keys',
      '/api/initial-admin',
    ]) {
      expect(body).toContain(path)
    }
  })
})
