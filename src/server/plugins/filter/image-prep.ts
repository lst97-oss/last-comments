import sharp from 'sharp'

// Image screening prep. Extraction mirrors the review widget renderer
// (`renderMarkdown` in `@lst97-oss/last-comments-widgets/client`): only
// `http(s)` images can render, so only they are ever fetched — `data:`,
// `blob:`, and `javascript:` sources fall back to alt text in the widget and
// are skipped here without a network call.

export type ImagePrepSettings = {
  maxImages: number
  timeoutMs: number
  maxBytes: number
  longestEdge: number
  quality: number
}

export type PreparedImage = { dataUrl: string; srcHost: string }

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*\]\(\s*(<[^>]+>|[^)\s]+)/g
const BARE_IMAGE_URL_PATTERN = /https?:\/\/[^\s)>'"]+?\.(?:jpg|jpeg|png|webp|gif)(?:[?#][^\s)>'"]*)?/gi

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

// Server-side fetch guard for third-party comment images: never fetch
// loopback or RFC-1918 hosts. (DNS-rebinding beyond the literal hostname is
// out of scope for v1 and documented in the plugin README.)
function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host === '0.0.0.0') return true
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true
  const private172 = host.match(/^172\.(\d+)\./)
  if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return true
  return false
}

export function extractImageUrls(bodyMarkdown: string, maxImages: number): string[] {
  if (maxImages <= 0) return []
  const found: string[] = []
  const seen = new Set<string>()
  const push = (raw: string) => {
    const parsed = toHttpUrl(raw)
    if (!parsed || isBlockedHost(parsed.hostname)) return
    const href = parsed.toString()
    if (seen.has(href)) return
    seen.add(href)
    if (found.length < maxImages) found.push(href)
  }
  for (const match of bodyMarkdown.matchAll(MARKDOWN_IMAGE_PATTERN)) push(match[1])
  for (const match of bodyMarkdown.matchAll(BARE_IMAGE_URL_PATTERN)) push(match[0])
  return found
}

export async function fetchAndShrink(
  url: string,
  settings: ImagePrepSettings,
  deps: { fetcher?: Fetcher } = {},
): Promise<PreparedImage | null> {
  const fetcher = deps.fetcher ?? fetch
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (isBlockedHost(parsed.hostname)) return null

  let response: Response
  try {
    response = await fetcher(url, { signal: AbortSignal.timeout(settings.timeoutMs) })
  } catch {
    return null
  }
  if (!response.ok) return null
  const contentType = response.headers.get('content-type') ?? ''
  // SVG is vector (not the widget's raster path) and GIF animation cannot
  // survive a JPEG thumbnail; animated GIFs still screen on frame one, but
  // SVGs are skipped outright.
  if (!contentType.startsWith('image/') || contentType.includes('svg')) return null
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > settings.maxBytes) return null

  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await response.arrayBuffer())
  } catch {
    return null
  }
  if (bytes.byteLength === 0 || bytes.byteLength > settings.maxBytes) return null

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
