import config from '@payload-config'
import { afterEach, expect, mock, spyOn, test } from 'bun:test'

const ENV_NAMES = ['PAYLOAD_PUBLIC_SERVER_URL', 'BLOG_SITE_KEY', 'BLOG_PUBLISHER_API_KEY'] as const
const savedEnv = Object.fromEntries(ENV_NAMES.map((name) => [name, process.env[name]]))

afterEach(() => {
  mock.restore()
  for (const name of ENV_NAMES) {
    if (savedEnv[name] === undefined) delete process.env[name]
    else process.env[name] = savedEnv[name]
  }
})

async function postsAfterDelete() {
  const sanitized = await config
  const posts = sanitized.collections.find((collection) => collection.slug === 'posts')
  const hook = posts?.hooks?.afterDelete?.[0]
  if (!hook) throw new Error('posts has no afterDelete hook')
  return hook
}

function deleteArgs(warn: () => void) {
  return { doc: { slug: 'hello-world' }, req: { payload: { logger: { warn } } }, id: 1 }
}

function configureBlog() {
  process.env.PAYLOAD_PUBLIC_SERVER_URL = 'https://blog.example'
  process.env.BLOG_SITE_KEY = 'site-key'
  process.env.BLOG_PUBLISHER_API_KEY = 'api-key'
}

test('deleting a post deletes its comment thread by slug', async () => {
  configureBlog()
  const fetch = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }))
  const hook = await postsAfterDelete()

  await hook(deleteArgs(mock(() => {})) as unknown as Parameters<typeof hook>[0])

  expect(fetch.mock.calls[0]).toEqual([
    'https://blog.example/api/admin/pages?site=site-key&pageKey=hello-world',
    { method: 'DELETE', headers: { 'x-api-key': 'api-key' } },
  ])
})

test('a post with no thread is not logged, but a failed delete is', async () => {
  configureBlog()
  const hook = await postsAfterDelete()
  const warn = mock(() => {})

  spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(null, { status: 404 }))
  await hook(deleteArgs(warn) as unknown as Parameters<typeof hook>[0])
  expect(warn).not.toHaveBeenCalled()

  spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('down', { status: 500 }))
  await hook(deleteArgs(warn) as unknown as Parameters<typeof hook>[0])
  expect(warn).toHaveBeenCalledTimes(1)
})
