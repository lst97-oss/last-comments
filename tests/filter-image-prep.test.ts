import { describe, expect, test } from 'bun:test'

import { extractImageUrls, fetchAndShrink } from '@/server/plugins/filter/image-prep'

const settings = { maxImages: 3, timeoutMs: 4000, maxBytes: 2_000_000, longestEdge: 512, quality: 60 }

describe('filter image extraction', () => {
  test('extracts markdown images and bare URLs, http(s) only', () => {
    const urls = extractImageUrls(
      'See ![alt](https://cdn.test/a.jpg "t") and https://cdn.test/b.png plus ![x](https://cdn.test/a.jpg)',
      3,
    )
    expect(urls).toEqual(['https://cdn.test/a.jpg', 'https://cdn.test/b.png'])
  })

  test('rejects data:, javascript: and blob: sources like the widget does', () => {
    expect(extractImageUrls('![a](data:image/png;base64,x) ![b](javascript:alert(1))', 3)).toEqual([])
  })

  test('dedupes, caps at maxImages, and returns [] when disabled', () => {
    const body = [
      '![1](https://cdn.test/1.jpg)',
      '![2](https://cdn.test/2.jpg)',
      '![3](https://cdn.test/3.jpg)',
      '![4](https://cdn.test/4.jpg)',
    ].join(' ')
    expect(extractImageUrls(body, 3)).toHaveLength(3)
    expect(extractImageUrls(body, 0)).toEqual([])
  })

  test('blocks loopback and private hosts (SSRF guard)', () => {
    expect(extractImageUrls('![a](http://127.0.0.1/x.jpg) ![b](http://localhost/y.png)', 3)).toEqual([])
    expect(extractImageUrls('![a](http://192.168.1.5/x.jpg)', 3)).toEqual([])
  })
})

describe('filter image shrinking', () => {
  test('downscales to a JPEG thumbnail within the edge budget', async () => {
    const sharp = (await import('sharp')).default
    const source = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#808080' } })
      .png()
      .toBuffer()
    const response = new Response(new Uint8Array(source), { headers: { 'content-type': 'image/png' } })
    const prepared = await fetchAndShrink('https://cdn.test/photo.png', settings, { fetcher: async () => response })
    expect(prepared).not.toBeNull()
    const bytes = Buffer.from(prepared!.dataUrl.split(',', 2)[1]!, 'base64')
    expect(prepared!.dataUrl.startsWith('data:image/jpeg;base64,')).toBe(true)
    expect(bytes.byteLength).toBeLessThan(source.byteLength)
    const meta = await sharp(bytes).metadata()
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBeLessThanOrEqual(512)
    expect(meta.format).toBe('jpeg')
    expect(prepared!.srcHost).toBe('cdn.test')
  })

  test('skips non-image content, oversize bodies, and svg', async () => {
    const html = new Response('nope', { headers: { 'content-type': 'text/html' } })
    await expect(fetchAndShrink('https://cdn.test/x.jpg', settings, { fetcher: async () => html })).resolves.toBeNull()
    const svg = new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } })
    await expect(fetchAndShrink('https://cdn.test/x.svg', settings, { fetcher: async () => svg })).resolves.toBeNull()
    const big = new Response(new Uint8Array(10), {
      headers: { 'content-type': 'image/png', 'content-length': String(settings.maxBytes + 1) },
    })
    await expect(fetchAndShrink('https://cdn.test/x.png', settings, { fetcher: async () => big })).resolves.toBeNull()
  })

  test('fetch failures resolve to null, never throw', async () => {
    await expect(
      fetchAndShrink('https://cdn.test/x.jpg', settings, {
        fetcher: async () => {
          throw new TypeError('down')
        },
      }),
    ).resolves.toBeNull()
    await expect(fetchAndShrink('not a url', settings)).resolves.toBeNull()
  })
})
