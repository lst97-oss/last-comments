import { describe, expect, test } from 'bun:test'
import { create, type Font } from 'fontkit'

import { measureText, renderTextPaths, wrapText } from '@/server/seo/og-text'

const FONT_PATH = new URL('../src/server/seo/fonts/jetbrains-mono-variable.ttf', import.meta.url)

async function loadFont(): Promise<Font> {
  const font = create(Buffer.from(await Bun.file(FONT_PATH).arrayBuffer()))
  if (!('layout' in font)) throw new Error('expected a single-face font')
  return font
}

describe('wrapText', () => {
  test('keeps short text on one line', async () => {
    const font = await loadFont()
    expect(wrapText(font, 'Blog · Last Comments', 28, 600, 4)).toEqual(['Blog · Last Comments'])
  })

  test('every wrapped line fits the column', async () => {
    const font = await loadFont()
    const lines = wrapText(font, 'Self-hosted comment threads for any page, with moderation and votes', 28, 400, 4)
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) {
      expect(measureText(font, line, 28)).toBeLessThanOrEqual(400)
    }
  })

  test('text beyond the line budget is cut with an ellipsis', async () => {
    const font = await loadFont()
    const lines = wrapText(font, 'word '.repeat(80), 28, 400, 2)
    expect(lines).toHaveLength(2)
    expect(lines.at(-1)).toEndWith('…')
    expect(measureText(font, lines.at(-1) ?? '', 28)).toBeLessThanOrEqual(400)
  })

  test('control characters collapse to single spaces', async () => {
    const font = await loadFont()
    expect(wrapText(font, 'Blog\n\n·  Last Comments', 28, 600, 4)).toEqual(['Blog · Last Comments'])
  })
})

describe('renderTextPaths', () => {
  test('emits one filled path per glyph', async () => {
    const font = await loadFont()
    const markup = renderTextPaths(font, 'Blog', { x: 300, baselineY: 400, size: 28, fill: '#111113' })
    expect(markup.match(/<path /g)).toHaveLength(font.layout('Blog').glyphs.length)
    expect(markup).toContain('fill="#111113"')
  })
})
