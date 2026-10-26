/**
 * Renders the social share card.
 *
 * The committed artwork (`og-artwork.webp`) is the background; the page's
 * title, description and the widget framework strip are drawn on top as SVG
 * paths. Text is converted to paths with fontkit instead of using SVG
 * `<text>`: the server image ships no system fonts, so librsvg would drop
 * the text silently.
 */
import { create as createFont, type Font } from 'fontkit'
import sharp from 'sharp'
import { z } from 'zod'

import { OG_FRAMEWORKS, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/lib/seo/og-image'
import { ErrorCode, HttpError } from '@/server/http/errors'
import { parseSearchParams } from '@/server/http/validation'
import { renderTextPaths, wrapText } from '@/server/seo/og-text'

import archivoBlackFontDataUrl from './fonts/archivo-black-regular.ttf?inline'
import jetBrainsMonoFontDataUrl from './fonts/jetbrains-mono-variable.ttf?inline'
import artworkDataUrl from './og-artwork.webp?inline'

const INK = '#111113'
const INK_SOFT = '#55555f'
const RULE = '#d8d8de'
/** Title sizes tried in order; the first one that fits the title wins. */
const TITLE_SIZES = [66, 60, 54, 48]
const TITLE_MAX_LINES = 3
const DESCRIPTION_SIZE = 28
const DESCRIPTION_LINE_HEIGHT = 40
const DESCRIPTION_MAX_LINES = 4
const FOOTER_SIZE = 26
const TEXT_LEFT = 300
const TITLE_WIDTH = 700
const DESCRIPTION_WIDTH = 600
const BLOCK_TOP = 250
const BLOCK_BOTTOM = 780
const RULE_Y = 818
const FOOTER_BASELINE = 858
const CACHE_CONTROL = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400'
const CACHE_LIMIT = 64

const cache = new Map<string, Uint8Array>()

export interface OpenGraphImageInput {
  title: string
  description: string
}

const ogImageQuery = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(300).default(''),
})

/** Handles one card request; validation errors surface as 400 through `withContext`. */
export async function handleOpenGraphImage(url: string): Promise<Response> {
  const { title, description } = parseSearchParams(url, ogImageQuery)
  const image = await renderOpenGraphImage({ title, description })
  return new Response(new Uint8Array(image), {
    headers: {
      'cache-control': CACHE_CONTROL,
      'content-length': String(image.byteLength),
      'content-type': 'image/webp',
      'x-content-type-options': 'nosniff',
    },
  })
}

// Each uncached card is CPU work on an unauthenticated route. Cap the renders in flight; a saturated
// instance answers 503 and a crawler retries. Cache hits never count against the cap.
const MAX_CONCURRENT_RENDERS = 4
let activeRenders = 0

export async function withRenderSlot<T>(render: () => Promise<T>): Promise<T> {
  if (activeRenders >= MAX_CONCURRENT_RENDERS) {
    throw new HttpError(
      ErrorCode.OG_RENDER_BUSY.status,
      ErrorCode.OG_RENDER_BUSY.code,
      'Image rendering is busy, retry shortly',
      {
        expose: true,
        headers: { 'retry-after': '2' },
      },
    )
  }
  activeRenders++
  try {
    return await render()
  } finally {
    activeRenders--
  }
}

export async function renderOpenGraphImage(input: OpenGraphImageInput): Promise<Uint8Array> {
  const key = `${input.title}\n${input.description}`
  const cached = cache.get(key)
  if (cached) return cached
  return withRenderSlot(() => renderUncached(key, input))
}

async function renderUncached(key: string, input: OpenGraphImageInput): Promise<Uint8Array> {
  const artwork = decodeDataUrl(artworkDataUrl)
  const metadata = await sharp(artwork).metadata()
  const width = metadata.width ?? OG_IMAGE_WIDTH
  const height = metadata.height ?? OG_IMAGE_HEIGHT
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}">${renderOverlay(input.title, input.description)}</svg>`

  const image = await sharp(artwork)
    .composite([{ input: Buffer.from(svg) }])
    .webp({ quality: 92, effort: 5 })
    .toBuffer()

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next()
    if (!oldest.done) cache.delete(oldest.value)
  }
  cache.set(key, image)
  return image
}

function renderOverlay(title: string, description: string): string {
  const titleFont = loadFont(archivoBlackFontDataUrl, 900)
  const descriptionFont = loadFont(jetBrainsMonoFontDataUrl, 500)
  const footerFont = loadFont(jetBrainsMonoFontDataUrl, 800)

  const titleLayout = layoutTitle(titleFont, title)
  const titleLines = titleLayout.lines
  const titleSize = titleLayout.size
  const titleLineHeight = Math.round(titleSize * 1.18)
  const descriptionLines = wrapText(
    descriptionFont,
    description,
    DESCRIPTION_SIZE,
    DESCRIPTION_WIDTH,
    DESCRIPTION_MAX_LINES,
  )

  const blockHeight =
    titleLines.length * titleLineHeight +
    (descriptionLines.length > 0 ? 52 + descriptionLines.length * DESCRIPTION_LINE_HEIGHT : 0)
  const blockTop = BLOCK_TOP + Math.max(0, (BLOCK_BOTTOM - BLOCK_TOP - blockHeight) / 2)
  const titleBaseline = blockTop + titleSize

  const titleMarkup = titleLines
    .map((line, index) =>
      renderTextPaths(titleFont, line, {
        x: TEXT_LEFT,
        baselineY: titleBaseline + index * titleLineHeight,
        size: titleSize,
        fill: INK,
      }),
    )
    .join('')

  const descriptionTop = titleBaseline + (titleLines.length - 1) * titleLineHeight + 52
  const descriptionMarkup = descriptionLines
    .map((line, index) =>
      renderTextPaths(descriptionFont, line, {
        x: TEXT_LEFT,
        baselineY: descriptionTop + index * DESCRIPTION_LINE_HEIGHT,
        size: DESCRIPTION_SIZE,
        fill: INK_SOFT,
      }),
    )
    .join('')

  const footerMarkup = renderTextPaths(footerFont, OG_FRAMEWORKS.join(' · '), {
    x: TEXT_LEFT,
    baselineY: FOOTER_BASELINE,
    size: FOOTER_SIZE,
    fill: INK,
  })

  return [
    `<rect x="${TEXT_LEFT}" y="${RULE_Y}" width="${TITLE_WIDTH}" height="2" fill="${RULE}"/>`,
    titleMarkup,
    descriptionMarkup,
    footerMarkup,
  ].join('')
}

/**
 * Picks the largest title size that fits the title in the allowed lines. A
 * title that never fits is truncated with an ellipsis on the last line.
 */
function layoutTitle(font: Font, text: string): { lines: string[]; size: number } {
  for (const size of TITLE_SIZES) {
    const lines = wrapText(font, text, size, TITLE_WIDTH, TITLE_MAX_LINES)
    if (!lines.at(-1)?.endsWith('…')) return { lines, size }
  }
  const size = TITLE_SIZES.at(-1) ?? 48
  return { lines: wrapText(font, text, size, TITLE_WIDTH, TITLE_MAX_LINES), size }
}

function loadFont(dataUrl: string, weight: number): Font {
  const font = createFont(Buffer.from(decodeDataUrl(dataUrl)))
  if (!('layout' in font)) throw new Error('OG fonts must be single-face font files')
  return font.variationAxes.wght ? font.getVariation({ wght: weight }) : font
}

function decodeDataUrl(value: string): Uint8Array {
  const separator = value.indexOf(',')
  if (separator < 0) throw new Error('OG assets must be inline base64 data URLs')
  const decoded = atob(value.slice(separator + 1))
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0))
}
