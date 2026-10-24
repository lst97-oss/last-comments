import { afterAll, describe, expect, test } from 'bun:test'

import { Route as CommentsRoute } from '@/routes/api.comments'
import { createAdminSite, updateAdminSite } from '@/server/modules/admin/infrastructure/admin-repository'
import { issueServiceKey } from '@/server/modules/api-keys/infrastructure/api-key-repository'
import { cleanupTestData, createOwner, handlerOf, keyIds, siteKeys } from './helpers/integration'

afterAll(cleanupTestData)

const origin = 'https://access.example.test'
const pageUrl = 'https://access.example.test/post'
const getComments = handlerOf(CommentsRoute, 'GET')

async function createSite(name: string) {
  const site = await createAdminSite(null, { name, origin })
  siteKeys.push(site.key)
  return site
}

function readRequest(siteKey: string, headers: Record<string, string> = {}) {
  const url = `http://localhost:3000/api/comments?site=${encodeURIComponent(siteKey)}&url=${encodeURIComponent(pageUrl)}`
  return new Request(url, { headers })
}

async function errorCode(response: Response): Promise<string | undefined> {
  const body = (await response.json()) as { error?: { code: string } }
  return body.error?.code
}

describe('site access and the gateway switch, end to end', () => {
  test('a new site defaults to open with the gateway off, so existing sites change nothing', async () => {
    const site = await createSite('Access defaults')
    expect(site).toMatchObject({ access: 'open', gatewayOnly: false })
  })

  test('an open site serves anonymous readers with no Origin, as before', async () => {
    const site = await createSite('Access open read')
    const response = await getComments(readRequest(site.key))
    expect(response.status).toBe(200)
  })

  test('a gateway-only site refuses a keyless reader, even with a registered Origin', async () => {
    const site = await createSite('Access gateway read')
    await updateAdminSite(site.key, { gatewayOnly: true })

    const bare = await getComments(readRequest(site.key))
    expect(bare.status).toBe(403)
    expect(await errorCode(bare)).toBe('FORBIDDEN')

    // The Origin header is a browser control, not proof of anything: a curl with
    // the registered Origin is refused too.
    const withOrigin = await getComments(readRequest(site.key, { origin }))
    expect(withOrigin.status).toBe(403)
    expect(await errorCode(withOrigin)).toBe('FORBIDDEN')
  })

  test('a comments:read key reads a gateway-only site, and only for its own site', async () => {
    const owner = await createOwner('Gateway host')
    const site = await createSite('Access gateway key')
    await updateAdminSite(site.key, { gatewayOnly: true })
    const reader = await issueServiceKey({
      userId: owner,
      name: 'host-reader',
      siteKey: site.key,
      scopes: ['comments:read'],
    })
    keyIds.push(reader.id)

    const allowed = await getComments(readRequest(site.key, { 'x-api-key': reader.key }))
    expect(allowed.status).toBe(200)

    const other = await createSite('Access gateway other')
    const foreign = await getComments(readRequest(other.key, { 'x-api-key': reader.key }))
    expect(foreign.status).toBe(403)
    expect(await errorCode(foreign)).toBe('INSUFFICIENT_SCOPE')
  })

  test('a login site lets anyone read, and a comments:read-only key cannot write', async () => {
    const owner = await createOwner('Login host')
    const site = await createSite('Access login read')
    await updateAdminSite(site.key, { access: 'login' })

    expect((await getComments(readRequest(site.key))).status).toBe(200)

    const reader = await issueServiceKey({
      userId: owner,
      name: 'read-only',
      siteKey: site.key,
      scopes: ['comments:read'],
    })
    keyIds.push(reader.id)
    expect(
      (
        await handlerOf(
          CommentsRoute,
          'POST',
        )(
          new Request('http://localhost:3000/api/comments', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-api-key': reader.key },
            body: JSON.stringify({ site: site.key, url: pageUrl, authorName: 'Host', bodyMarkdown: 'hi' }),
          }),
        )
      ).status,
    ).toBe(403)
  })

  test('a comments:write key passes the gate and reaches the write pipeline on a gateway-only site', async () => {
    const owner = await createOwner('Gateway writer')
    const site = await createSite('Access gateway write')
    await updateAdminSite(site.key, { gatewayOnly: true })
    const writer = await issueServiceKey({
      userId: owner,
      name: 'host-writer',
      siteKey: site.key,
      scopes: ['comments:write'],
    })
    keyIds.push(writer.id)

    // No Origin and no verification token: the gate is passed, then the write
    // pipeline's own checks answer. Anything but a gate refusal proves the key got through.
    const response = await handlerOf(
      CommentsRoute,
      'POST',
    )(
      new Request('http://localhost:3000/api/comments', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': writer.key },
        body: JSON.stringify({ site: site.key, url: pageUrl, authorName: 'Visitor', bodyMarkdown: 'hello' }),
      }),
    )
    const code = response.status === 200 ? 'ok' : await errorCode(response)
    expect(['ok', 'COMMENT_VERIFICATION_FAILED', 'COMMENT_VERIFICATION_UNAVAILABLE']).toContain(code ?? 'ok')
  })

  test('a private site refuses an anonymous reader and admits a comments:read key', async () => {
    const owner = await createOwner('Private host')
    const site = await createSite('Access private')
    await updateAdminSite(site.key, { access: 'private' })

    const anonymous = await getComments(readRequest(site.key))
    expect(anonymous.status).toBe(401)
    expect(await errorCode(anonymous)).toBe('UNAUTHENTICATED')

    const reader = await issueServiceKey({
      userId: owner,
      name: 'private-reader',
      siteKey: site.key,
      scopes: ['comments:read'],
    })
    keyIds.push(reader.id)
    expect((await getComments(readRequest(site.key, { 'x-api-key': reader.key }))).status).toBe(200)
  })

  test('the admin update changes only the fields given and rejects an unknown access level at the database', async () => {
    const site = await createSite('Access partial update')
    const updated = await updateAdminSite(site.key, { gatewayOnly: true })
    expect(updated).toMatchObject({ access: 'open', gatewayOnly: true })

    await expect(updateAdminSite(site.key, { access: 'public' as 'open' })).rejects.toThrow()
  })
})
