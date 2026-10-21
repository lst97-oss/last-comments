import { describe, expect, test } from 'bun:test'

import { codeBlockMarkup, escapeHtml, normalizeCodeLanguage } from '@/lib/code-block'

describe('normalizeCodeLanguage', () => {
  test('strips the language- prefix and lowercases', () => {
    expect(normalizeCodeLanguage('language-TSX')).toBe('tsx')
  })

  test('falls back to text for empty input', () => {
    expect(normalizeCodeLanguage(null)).toBe('text')
    expect(normalizeCodeLanguage('')).toBe('text')
  })

  test('strips unexpected characters', () => {
    expect(normalizeCodeLanguage('language-tsx;alert(1)')).toBe('tsxalert1')
  })
})

describe('escapeHtml', () => {
  test('escapes markup characters', () => {
    expect(escapeHtml('<a href="x">&')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;')
  })
})

describe('codeBlockMarkup', () => {
  test('escapes the source so it cannot inject markup', () => {
    const markup = codeBlockMarkup('tsx', '<script>alert(1)</script>')
    expect(markup).not.toContain('<script>')
    expect(markup).toContain('&lt;script&gt;')
  })

  test('marks the block as pending until the highlighter lands', () => {
    const markup = codeBlockMarkup('tsx', 'const x = 1')
    expect(markup).toContain('class="lc-codeblock"')
    expect(markup).toContain('data-shiki="pending"')
    expect(markup).toContain('class="language-tsx"')
  })

  test('falls back to a plain language for an unusable one', () => {
    expect(codeBlockMarkup('language-tsx;alert(1)', 'const x = 1')).toContain('class="language-tsxalert1"')
  })
})
