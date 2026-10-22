/**
 * Text helpers for the social card.
 *
 * The card draws text as SVG paths, so every measurement goes through
 * fontkit: a line that overflows the column would bleed into the artwork.
 */
import type { Font } from 'fontkit'

export type TextPathOptions = {
  x: number
  baselineY: number
  size: number
  fill: string
}

/** Rendered width of `text` at `size`, in pixels. */
export function measureText(font: Font, text: string, size: number): number {
  const run = font.layout(text)
  let width = 0
  for (const position of run.positions) width += position.xAdvance
  return width * (size / font.unitsPerEm)
}

/**
 * Wraps `text` into at most `maxLines` lines that fit `maxWidth`. Text that
 * does not fit is cut at a word boundary and marked with an ellipsis.
 */
export function wrapText(font: Font, text: string, size: number, maxWidth: number, maxLines: number): string[] {
  const words = normalizeText(text).split(' ').filter(Boolean)
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (measureText(font, candidate, size) <= maxWidth) {
      line = candidate
      continue
    }

    if (lines.length === maxLines - 1) {
      lines.push(fitWithEllipsis(font, candidate, size, maxWidth))
      return lines
    }

    if (line) lines.push(line)
    line = word
  }

  if (line && lines.length < maxLines) lines.push(line)
  return lines
}

/** SVG path markup for `text`, placed at the given baseline. */
export function renderTextPaths(font: Font, text: string, options: TextPathOptions): string {
  const run = font.layout(text)
  const scale = options.size / font.unitsPerEm
  const paths: string[] = []
  let penX = 0

  for (const [index, glyph] of run.glyphs.entries()) {
    const position = run.positions[index]
    if (!position) continue

    const path = glyph.path.toSVG()
    if (path) {
      const x = options.x + (penX + position.xOffset) * scale
      const y = options.baselineY - position.yOffset * scale
      paths.push(
        `<path d="${path}" fill="${options.fill}" transform="translate(${x} ${y}) scale(${scale} ${-scale})"/>`,
      )
    }

    penX += position.xAdvance
  }

  return paths.join('')
}

function fitWithEllipsis(font: Font, text: string, size: number, maxWidth: number): string {
  const words = text.split(' ')
  while (words.length > 1) {
    words.pop()
    const candidate = `${words.join(' ')}…`
    if (measureText(font, candidate, size) <= maxWidth) return candidate
  }
  return '…'
}

function normalizeText(value: string): string {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint < 32 || codePoint === 127 ? ' ' : character
  })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}
