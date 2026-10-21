import { afterAll, describe, expect, test } from 'bun:test'

import { Route as AdminPagesRoute } from '@/routes/api.admin.pages'
import { createAdminSite } from '@/server/modules/admin/infrastructure/admin-repository'
import { assertValidScopeSet, issueServiceKey } from '@/server/modules/api-keys/infrastructure/api-key-repository'
import { cleanupTestData, createOwner, handlerOf, jsonRequest, keyIds, siteKeys } from './helpers/integration'

afterAll(cleanupTestData)

async function createSite(name: string) {
  const site = await createAdminSite(null, { name, origin: 'https://pages.example.test' })
  siteKeys.push(site.key)
  return site
}

const createPage = handlerOf(AdminPagesRoute, 'POST')
const listPages = handlerOf(AdminPagesRoute, 'GET')

describe('publisher pages API', () => {
  test('a pages:write key registers threads; the slug follows the url', async () => {
    const ownerId = await createOwner('Publisher')
    const site = await createSite('Pages publisher')
    const publisher = await issueServiceKey({
      userId: ownerId,
      name: 'publisher',
      siteKey: site.key,
      scopes: ['pages:read', 'pages:write'],
    })
    keyIds.push(publisher.id)
    const auth = { authorization: `Bearer ${publisher.key}` }

    const first = await createPage(
      jsonRequest(
        'http://localhost:3000/api/admin/pages',
        'POST',
        { site: site.key, url: 'https://pages.example.test/first', pageKey: 'first-post', title: 'First post' },
        auth,
      ),
    )
    expect(first.status).toBe(200)
    const firstPage = (await first.json()) as { data: { page: { id: string; pageKey: string; title: string } } }
    expect(firstPage.data.page.pageKey).toBe('first-post')
    expect(firstPage.data.page.title).toBe('First post')

    // Idempotent on publish retries: same slug + url keeps the same thread.
    const repeat = await createPage(
      jsonRequest(
        'http://localhost:3000/api/admin/pages',
        'POST',
        { site: site.key, url: 'https://pages.example.test/first', pageKey: 'first-post' },
        auth,
      ),
    )
    const repeated = (await repeat.json()) as { data: { page: { id: string } } }
    expect(repeated.data.page.id).toBe(firstPage.data.page.id)

    // The url moved: the keyed thread keeps its id and takes the new url.
    const moved = await createPage(
      jsonRequest(
        'http://localhost:3000/api/admin/pages',
        'POST',
        { site: site.key, url: 'https://pages.example.test/first-renamed', pageKey: 'first-post' },
        auth,
      ),
    )
    const movedPage = (await moved.json()) as { data: { page: { id: string; canonicalUrl: string } } }
    expect(movedPage.data.page.id).toBe(firstPage.data.page.id)
    expect(movedPage.data.page.canonicalUrl).toBe('https://pages.example.test/first-renamed')

    // A url already owned by another slug is a conflict, never a merge.
    const conflict = await createPage(
      jsonRequest(
        'http://localhost:3000/api/admin/pages',
        'POST',
        { site: site.key, url: 'https://pages.example.test/first-renamed', pageKey: 'second-post' },
        auth,
      ),
    )
    expect(conflict.status).toBe(409)
    expect(((await conflict.json()) as { error: { code: string } }).error.code).toBe('PAGE_KEY_MISMATCH')

    const listed = await listPages(
      new Request(`http://localhost:3000/api/admin/pages?site=${site.key}`, { headers: auth }),
    )
    expect(listed.status).toBe(200)
    const pages = (await listed.json()) as { data: { pages: { pageKey: string | null }[] } }
    expect(pages.data.pages.some((page) => page.pageKey === 'first-post')).toBe(true)
  })

  test('keys are bound to their own site and to their scopes', async () => {
    const ownerId = await createOwner('Publisher')
    const site = await createSite('Pages bound')
    const other = await createSite('Pages other')
    const writer = await issueServiceKey({
      userId: ownerId,
      name: 'writer',
      siteKey: site.key,
      scopes: ['pages:read', 'pages:write'],
    })
    const reader = await issueServiceKey({ userId: ownerId, name: 'reader', siteKey: site.key, scopes: ['pages:read'] })
    keyIds.push(writer.id, reader.id)

    const body = { site: other.key, url: 'https://pages.example.test/cross-site' }
    const crossSite = await createPage(
      jsonRequest('http://localhost:3000/api/admin/pages', 'POST', body, {
        authorization: `Bearer ${writer.key}`,
      }),
    )
    expect(crossSite.status).toBe(403)

    const readOnly = await createPage(
      jsonRequest(
        'http://localhost:3000/api/admin/pages',
        'POST',
        { ...body, site: site.key },
        {
          authorization: `Bearer ${reader.key}`,
        },
      ),
    )
    expect(readOnly.status).toBe(403)

    const crossSiteRead = await listPages(
      new Request(`http://localhost:3000/api/admin/pages?site=${other.key}`, {
        headers: { authorization: `Bearer ${reader.key}` },
      }),
    )
    expect(crossSiteRead.status).toBe(403)

    // Same order as /api/admin/sites: origin first (browsers always send it on
    // writes), then the session.
    const anonymous = await createPage(
      jsonRequest('http://localhost:3000/api/admin/pages', 'POST', { ...body, site: site.key }),
    )
    expect(anonymous.status).toBe(403)
    const anonymousSameOrigin = await createPage(
      jsonRequest(
        'http://localhost:3000/api/admin/pages',
        'POST',
        { ...body, site: site.key, url: 'https://pages.example.test/anon' },
        { origin: 'http://localhost:3000' },
      ),
    )
    expect(anonymousSameOrigin.status).toBe(401)

    // Page URLs must live on the site's allowed origins.
    const foreignOrigin = await createPage(
      jsonRequest(
        'http://localhost:3000/api/admin/pages',
        'POST',
        { site: site.key, url: 'https://evil.example.test/post' },
        { authorization: `Bearer ${writer.key}` },
      ),
    )
    expect(foreignOrigin.status).toBe(400)
    expect(((await foreignOrigin.json()) as { error: { code: string } }).error.code).toBe('PAGE_ORIGIN_NOT_ALLOWED')

    const badUrl = await createPage(
      jsonRequest(
        'http://localhost:3000/api/admin/pages',
        'POST',
        { site: site.key, url: 'not-a-url' },
        {
          authorization: `Bearer ${writer.key}`,
        },
      ),
    )
    expect(badUrl.status).toBe(400)
    expect(((await badUrl.json()) as { error: { code: string } }).error.code).toBe('INVALID_PAGE_URL')
  })

  test('lists threads with recent-window activity and honors window params', async () => {
    const ownerId = await createOwner('Recent reader')
    const site = await createSite('Pages recent')
    const writer = await issueServiceKey({
      userId: ownerId,
      name: 'recent-writer',
      siteKey: site.key,
      scopes: ['pages:read', 'pages:write'],
    })
    const reader = await issueServiceKey({ userId: ownerId, name: 'reader', siteKey: site.key, scopes: ['pages:read'] })
    keyIds.push(writer.id, reader.id)
    const auth = { authorization: `Bearer ${reader.key}` }

    const created = await createPage(
      jsonRequest(
        'http://localhost:3000/api/admin/pages',
        'POST',
        {
          site: site.key,
          url: 'https://pages.example.test/recent',
          title: 'Recent thread',
        },
        { authorization: `Bearer ${writer.key}` },
      ),
    )
    expect(created.status).toBe(200)

    const listed = await listPages(
      new Request(`http://localhost:3000/api/admin/pages?site=${site.key}&recentDays=1&preview=2`, { headers: auth }),
    )
    expect(listed.status).toBe(200)
    const body = (await listed.json()) as {
      data: {
        pages: {
          canonicalUrl: string
          recent: {
            windowDays: number
            count: number
            totalAuthors: number
            authors: unknown[]
            preview: unknown[]
          }
        }[]
      }
    }
    const thread = body.data.pages.find((page) => page.canonicalUrl === 'https://pages.example.test/recent')
    expect(thread?.recent).toMatchObject({ windowDays: 1, count: 0, totalAuthors: 0, authors: [], preview: [] })

    // Bounds are enforced, not clamped: a zero-day window is a 400.
    const invalid = await listPages(
      new Request(`http://localhost:3000/api/admin/pages?site=${site.key}&recentDays=0`, { headers: auth }),
    )
    expect(invalid.status).toBe(400)
  })

  test('instance keys cannot hold page scopes', () => {
    expect(() => assertValidScopeSet(null, ['pages:write'])).toThrow()
    expect(() => assertValidScopeSet('some-site-1234abcd', ['sites:read'])).toThrow()
    expect(() => assertValidScopeSet('some-site-1234abcd', ['pages:write'])).not.toThrow()
  })
})
