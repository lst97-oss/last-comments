import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import sharp from 'sharp'

// Image screening prep. Extraction mirrors the review widget renderer
// (`renderMarkdown` in `@lst97-oss/last-comments-widgets/client`): only
// `http(s)` images can render, so only they are ever fetched — `data:`,
// `blob:`, and `javascript:` sources fall back to alt text in the widget and
// are skipped here without a network call.
//
// Fetching a commenter's URL is a server-side request, so every hop is checked:
// the host must resolve only to public addresses, redirects are followed by
// hand (a public host can redirect to an internal one), and only default
// web ports are used.

export type ImagePrepSettings = {
  maxImages: number
  timeoutMs: number
  maxBytes: number
  longestEdge: number
  quality: number
}

export type PreparedImage = { dataUrl: string; srcHost: string }

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
// Resolves a hostname to every address it currently maps to.
export type HostResolver = (hostname: string) => Promise<readonly string[]>

const MAX_REDIRECTS = 3
const ALLOWED_PORTS = new Set(['', '80', '443'])

const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\(\s*(<[^>]+>|[^)\s]+)/g
const BARE_IMAGE_URL_PATTERN = /https?:\/\/[^\s)>'"]+?\.(?:jpg|jpeg|png|webp|gif)(?:[?#][^\s)>'"]*)?/gi

const defaultResolver: HostResolver = async (hostname) =>
  (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address)

function toHttpUrl(raw: string): URL | null {
  const cleaned = raw.trim().replace(/^<|>$/g, '')
  try {
    const parsed = new URL(cleaned)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed
  } catch {
    return null
  }
}

// Ranges no comment image may reach: loopback, private, link-local (cloud metadata), carrier-grade NAT,
// unspecified, documentation, benchmarking, multicast and reserved space.
const BLOCKED_V4: readonly [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
]

function v4ToInt(address: string): number {
  return address.split('.').reduce((total, octet) => total * 256 + Number(octet), 0)
}

function isBlockedV4(address: string): boolean {
  const value = v4ToInt(address)
  return BLOCKED_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
    return (value & mask) >>> 0 === (v4ToInt(base) & mask) >>> 0
  })
}

// Expands an IPv6 literal (with `::` and an optional dotted-quad tail) into eight 16-bit groups.
function ipv6Groups(address: string): number[] | null {
  let head = address
  const lastColon = address.lastIndexOf(':')
  const tail = address.slice(lastColon + 1)
  if (tail.includes('.')) {
    if (isIP(tail) !== 4) return null
    const value = v4ToInt(tail)
    head = `${address.slice(0, lastColon + 1)}${((value >>> 16) & 0xffff).toString(16)}:${(value & 0xffff).toString(16)}`
  }
  const sections = head.split('::')
  if (sections.length > 2) return null
  const side = (text: string) => (text === '' ? [] : text.split(':'))
  const left = side(sections[0] ?? '')
  const right = sections.length === 2 ? side(sections[1] ?? '') : []
  const fill = 8 - left.length - right.length
  if (sections.length === 1 ? left.length !== 8 : fill < 1) return null
  const groups = [...left, ...Array<string>(sections.length === 2 ? fill : 0).fill('0'), ...right]
  const numbers = groups.map((group) => Number.parseInt(group, 16))
  return numbers.length === 8 && numbers.every((value) => Number.isInteger(value) && value >= 0 && value <= 0xffff)
    ? numbers
    : null
}

function isBlockedV6(address: string): boolean {
  const groups = ipv6Groups(address)
  if (!groups) return true
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = groups
  // Unspecified, loopback, and deprecated IPv4-compatible (::/96).
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return true
  // IPv4-mapped (::ffff:a.b.c.d): judged by the IPv4 rules.
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
    return isBlockedV4(`${g6 >> 8}.${g6 & 0xff}.${g7 >> 8}.${g7 & 0xff}`)
  }
  // 6to4 (2002::/16) carries an IPv4 address in bits 16-47; judge that address.
  if (g0 === 0x2002) return isBlockedV4(`${g1 >> 8}.${g1 & 0xff}.${g2 >> 8}.${g2 & 0xff}`)
  // NAT64 well-known prefix (64:ff9b::/96) can translate private IPv4 space.
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return true
  // Unique-local (fc00::/7), link-local (fe80::/10), multicast (ff00::/8).
  if ((g0 & 0xfe00) === 0xfc00 || (g0 & 0xffc0) === 0xfe80 || (g0 & 0xff00) === 0xff00) return true
  return false
}

// True for any address a comment image must not reach. Accepts IPv4, IPv6, and bracketed IPv6.
export function isBlockedAddress(raw: string): boolean {
  const address = raw.replace(/^\[|\]$/g, '').toLowerCase()
  const family = isIP(address)
  if (family === 4) return isBlockedV4(address)
  if (family === 6) return isBlockedV6(address)
  return true
}

// Cheap refusal for hostnames that are obviously internal, before any DNS lookup.
function isBlockedName(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return host === 'localhost' || host.endsWith('.localhost')
}

export function extractImageUrls(bodyMarkdown: string, maxImages: number): string[] {
  if (maxImages <= 0) return []
  const found: string[] = []
  const seen = new Set<string>()
  const push = (raw: string) => {
    const parsed = toHttpUrl(raw)
    if (!parsed || !ALLOWED_PORTS.has(parsed.port)) return
    const host = parsed.hostname.replace(/^\[|\]$/g, '')
    if (isIP(host) ? isBlockedAddress(host) : isBlockedName(host)) return
    const href = parsed.toString()
    if (seen.has(href)) return
    seen.add(href)
    if (found.length < maxImages) found.push(href)
  }
  for (const match of bodyMarkdown.matchAll(MARKDOWN_IMAGE_PATTERN)) push(match[1])
  for (const match of bodyMarkdown.matchAll(BARE_IMAGE_URL_PATTERN)) push(match[0])
  return found
}

// A URL may be fetched only if it is plain web traffic to a host whose every address is public.
async function isPublicWebUrl(url: URL, resolve: HostResolver): Promise<boolean> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  if (url.username || url.password || !ALLOWED_PORTS.has(url.port)) return false
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host)) return !isBlockedAddress(host)
  if (isBlockedName(host)) return false
  let addresses: readonly string[]
  try {
    addresses = await resolve(host)
  } catch {
    return false
  }
  return addresses.length > 0 && addresses.every((address) => !isBlockedAddress(address))
}

// Follows redirects one hop at a time so each target is checked before it is requested. The timeout
// covers the whole chain, not each hop.
// shortcut: the address is checked, then the connection resolves the name again, so a name that flips to a
// private address in between can pass. Upgrade by connecting to the checked address with a pinned lookup.
async function fetchPublic(
  start: URL,
  fetcher: Fetcher,
  resolve: HostResolver,
  signal: AbortSignal,
): Promise<Response | null> {
  let current = start
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await isPublicWebUrl(current, resolve))) return null
    const response = await fetcher(current, { redirect: 'manual', signal })
    if (response.status < 300 || response.status >= 400) return response
    await response.body?.cancel()
    const location = response.headers.get('location')
    if (!location) return null
    try {
      current = new URL(location, current)
    } catch {
      return null
    }
  }
  return null
}

// Reads the body up to `maxBytes`, stopping as soon as the cap is passed.
async function readCapped(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  if (!response.body) return null
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export async function fetchAndShrink(
  url: string,
  settings: ImagePrepSettings,
  deps: { fetcher?: Fetcher; resolve?: HostResolver } = {},
): Promise<PreparedImage | null> {
  const fetcher = deps.fetcher ?? fetch
  const resolve = deps.resolve ?? defaultResolver
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  let response: Response | null
  try {
    response = await fetchPublic(parsed, fetcher, resolve, AbortSignal.timeout(settings.timeoutMs))
  } catch {
    return null
  }
  if (!response?.ok) return null
  const contentType = response.headers.get('content-type') ?? ''
  // SVG is vector (not the widget's raster path) and GIF animation cannot
  // survive a JPEG thumbnail; animated GIFs still screen on frame one, but
  // SVGs are skipped outright.
  if (!contentType.startsWith('image/') || contentType.includes('svg')) return null
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > settings.maxBytes) return null

  let bytes: Uint8Array | null
  try {
    bytes = await readCapped(response, settings.maxBytes)
  } catch {
    return null
  }
  if (!bytes || bytes.byteLength === 0) return null

  try {
    const thumbnail = await sharp(bytes)
      .rotate()
      .resize({ width: settings.longestEdge, height: settings.longestEdge, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: settings.quality, mozjpeg: true })
      .toBuffer()
    const dataUrl = `data:image/jpeg;base64,${thumbnail.toString('base64')}`
    return { dataUrl, srcHost: parsed.hostname.toLowerCase() }
  } catch {
    return null
  }
}
