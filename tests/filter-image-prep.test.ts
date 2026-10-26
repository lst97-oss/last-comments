import { describe, expect, test } from 'bun:test'

import { extractImageUrls, fetchAndShrink, isBlockedAddress } from '@/server/plugins/filter/image-prep'

const settings = { maxImages: 3, timeoutMs: 4000, maxBytes: 2_000_000, longestEdge: 512, quality: 60 }

// Every test host resolves to a public address unless it says otherwise.
const publicResolver = async () => ['93.184.216.34']

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

  test('blocks loopback and private literal hosts (SSRF guard)', () => {
    expect(extractImageUrls('![a](http://127.0.0.1/x.jpg) ![b](http://localhost/y.png)', 3)).toEqual([])
    expect(extractImageUrls('![a](http://192.168.1.5/x.jpg)', 3)).toEqual([])
    expect(extractImageUrls('![a](http://169.254.169.254/latest/meta-data/x.png)', 3)).toEqual([])
    expect(extractImageUrls('![a](http://[::1]/x.jpg) ![b](http://[::ffff:127.0.0.1]/y.jpg)', 3)).toEqual([])
  })

  test('only default web ports are fetched', () => {
    expect(extractImageUrls('![a](http://cdn.test:8080/x.jpg) ![b](https://cdn.test:8443/y.jpg)', 3)).toEqual([])
    expect(extractImageUrls('![a](https://cdn.test:443/x.jpg)', 3)).toEqual(['https://cdn.test/x.jpg'])
  })
})

describe('isBlockedAddress', () => {
  test('blocks every non-public range, including bracketed and mapped forms', () => {
    for (const address of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '0.0.0.0',
      '224.0.0.1',
      '::1',
      '[::1]',
      '::',
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      '[::ffff:10.0.0.5]',
      '2002:7f00:0001::1',
      'fc00::1',
      'fd12:3456::1',
      'fe80::1',
      'ff02::1',
      '64:ff9b::7f00:1',
      'not-an-address',
    ]) {
      expect(isBlockedAddress(address)).toBe(true)
    }
  })

  test('allows public addresses', () => {
    for (const address of ['93.184.216.34', '1.1.1.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
      expect(isBlockedAddress(address)).toBe(false)
    }
  })
})

describe('filter image shrinking', () => {
  test('downscales to a JPEG thumbnail within the edge budget', async () => {
    const sharp = (await import('sharp')).default
    const source = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#808080' } })
      .png()
      .toBuffer()
    const response = new Response(new Uint8Array(source), { headers: { 'content-type': 'image/png' } })
    const prepared = await fetchAndShrink('https://cdn.test/photo.png', settings, {
      fetcher: async () => response,
      resolve: publicResolver,
    })
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
    const deps = { resolve: publicResolver }
    const html = new Response('nope', { headers: { 'content-type': 'text/html' } })
    await expect(
      fetchAndShrink('https://cdn.test/x.jpg', settings, { ...deps, fetcher: async () => html }),
    ).resolves.toBeNull()
    const svg = new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } })
    await expect(
      fetchAndShrink('https://cdn.test/x.svg', settings, { ...deps, fetcher: async () => svg }),
    ).resolves.toBeNull()
    const big = new Response(new Uint8Array(10), {
      headers: { 'content-type': 'image/png', 'content-length': String(settings.maxBytes + 1) },
    })
    await expect(
      fetchAndShrink('https://cdn.test/x.png', settings, { ...deps, fetcher: async () => big }),
    ).resolves.toBeNull()
  })

  test('stops reading a streamed body once it passes the byte cap', async () => {
    const streamed = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(settings.maxBytes + 1))
        controller.close()
      },
    })
    const response = new Response(streamed, { headers: { 'content-type': 'image/png' } })
    await expect(
      fetchAndShrink('https://cdn.test/huge.png', settings, { fetcher: async () => response, resolve: publicResolver }),
    ).resolves.toBeNull()
  })

  test('fetch failures resolve to null, never throw', async () => {
    await expect(
      fetchAndShrink('https://cdn.test/x.jpg', settings, {
        resolve: publicResolver,
        fetcher: async () => {
          throw new TypeError('down')
        },
      }),
    ).resolves.toBeNull()
    await expect(fetchAndShrink('not a url', settings)).resolves.toBeNull()
  })
})

describe('filter image SSRF guard', () => {
  test('never requests a host that resolves to a private or metadata address', async () => {
    const requested: string[] = []
    const fetcher = async (input: RequestInfo | URL) => {
      requested.push(String(input))
      return new Response(new Uint8Array(4), { headers: { 'content-type': 'image/png' } })
    }
    await expect(
      fetchAndShrink('https://evil.test/x.png', settings, {
        fetcher,
        resolve: async () => ['10.0.0.5', '93.184.216.34'],
      }),
    ).resolves.toBeNull()
    expect(requested).toEqual([])
  })

  test('refuses a redirect into private space and does not make the second request', async () => {
    const requested: string[] = []
    const fetcher = async (input: RequestInfo | URL) => {
      requested.push(String(input))
      return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } })
    }
    await expect(
      fetchAndShrink('https://cdn.test/start.png', settings, { fetcher, resolve: publicResolver }),
    ).resolves.toBeNull()
    expect(requested).toEqual(['https://cdn.test/start.png'])
  })

  test('follows a redirect to another public host, checking it first', async () => {
    const requested: string[] = []
    const sharp = (await import('sharp')).default
    const source = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#808080' } })
      .png()
      .toBuffer()
    const fetcher = async (input: RequestInfo | URL) => {
      requested.push(String(input))
      if (requested.length === 1) {
        return new Response(null, { status: 301, headers: { location: '/moved/photo.png' } })
      }
      return new Response(new Uint8Array(source), { headers: { 'content-type': 'image/png' } })
    }
    const prepared = await fetchAndShrink('https://cdn.test/start.png', settings, { fetcher, resolve: publicResolver })
    expect(prepared).not.toBeNull()
    expect(requested).toEqual(['https://cdn.test/start.png', 'https://cdn.test/moved/photo.png'])
  })
})
