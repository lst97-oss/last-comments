import { describe, expect, test } from 'bun:test'

import { HttpError } from '@/server/http/errors'
import { assertPageOriginAllowed } from '@/server/modules/comments/http/page-origin'

// The registered-origin port is injected, so these run without the database.
const registered = (origins: string[]) => async (_siteKey: string, origin: string) =>
  origins.includes(origin) ? origin : null

describe('page origin', () => {
  test('a browser may open a thread only on the origin it is calling from', async () => {
    const caller = { responseOrigin: 'https://blog.example' }
    await expect(
      assertPageOriginAllowed(caller, 'blog', 'https://blog.example/posts/1', registered([])),
    ).resolves.toBeUndefined()
    await expect(
      assertPageOriginAllowed(caller, 'blog', 'https://other.example/posts/1', registered(['https://other.example'])),
    ).rejects.toMatchObject({ status: 403, code: 'ORIGIN_NOT_ALLOWED' })
  })

  test('a key may open a thread on any origin the site registered', async () => {
    const caller = { keyId: 'key-1', responseOrigin: null }
    await expect(
      assertPageOriginAllowed(caller, 'lst97-dev', 'https://lst97.dev/blog', registered(['https://lst97.dev'])),
    ).resolves.toBeUndefined()
  })

  test('a key is refused on an unregistered origin with the publisher error, and the error names it', async () => {
    const caller = { keyId: 'key-1', responseOrigin: null }
    const error = await assertPageOriginAllowed(
      caller,
      'lst97-dev',
      'https://unclaimed.example/post',
      registered(['https://lst97.dev']),
    ).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(HttpError)
    expect(error).toMatchObject({ status: 400, code: 'PAGE_ORIGIN_NOT_ALLOWED' })
    expect((error as Error).message).toContain('https://unclaimed.example')
  })

  test('the origin is compared normalized, so a default port or a path does not change the answer', async () => {
    const caller = { responseOrigin: 'https://blog.example' }
    await expect(
      assertPageOriginAllowed(caller, 'blog', 'https://blog.example:443/a/b?x=1#frag', registered([])),
    ).resolves.toBeUndefined()
  })
})
