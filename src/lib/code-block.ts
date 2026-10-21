// Vanilla DOM on purpose — these nodes live inside dangerouslySetInnerHTML
// HTML that React doesn't manage, so plain construction avoids extra roots.

const ICON_SIZE = 14

const COPY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`

const CHECK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`

export function normalizeCodeLanguage(raw: string | null | undefined): string {
  const cleaned = (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^language-/, '')
    .replace(/[^a-z0-9+#_-]/g, '')
  return cleaned || 'text'
}

export function escapeHtml(raw: string): string {
  return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text)
    return
  }
  const area = document.createElement('textarea')
  area.value = text
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.append(area)
  area.select()
  document.execCommand('copy')
  area.remove()
}

// The live region next to the copy button: the icon swap is visual only, so
// screen readers need the text to know the copy landed.
function announce(button: HTMLButtonElement, message: string): void {
  const status = button.parentElement?.querySelector('[data-codeblock-status]')
  if (status) status.textContent = message
}

function wireCopyButton(button: HTMLButtonElement, lang: string, source: string): void {
  button.addEventListener('click', () => {
    void copyText(source)
      .then(() => {
        button.innerHTML = CHECK_SVG
        button.setAttribute('data-copied', 'true')
        announce(button, 'Copied')
        window.setTimeout(() => {
          button.innerHTML = COPY_SVG
          button.removeAttribute('data-copied')
          announce(button, '')
        }, 1500)
      })
      .catch(() => {
        // Clipboard unavailable: leave the copy icon in place.
      })
  })
  button.setAttribute('aria-label', `Copy ${lang} code to clipboard`)
}

// The frame is rendered with the markdown so the block keeps its final shape
// while the highlighter is in flight; without it the block jumps when the
// highlighted markup replaces the base one.
export function codeBlockFrameMarkup(lang: string): string {
  return `<div class="lc-codeblock"><div class="lc-codeblock-header"><span class="lc-codeblock-lang">${lang}</span><button type="button" class="lc-codeblock-copy" aria-label="Copy ${lang} code to clipboard" aria-disabled="true">${COPY_SVG}</button><span class="sr-only" aria-live="polite" data-codeblock-status></span></div>`
}

// The source is escaped here, so callers pass raw code.
export function codeBlockMarkup(lang: string, source: string): string {
  const language = normalizeCodeLanguage(lang)
  return codeBlockMarkupFromHtml(language, escapeHtml(source))
}

// Callers of this variant pass source that is already HTML-escaped (the
// markdown pipeline escapes the code it renders) — do not escape again.
export function codeBlockMarkupFromHtml(language: string, sourceHtml: string): string {
  return `${codeBlockFrameMarkup(language)}<pre data-shiki="pending" aria-busy="true"><code class="language-${language}">${sourceHtml}</code></pre></div>`
}

export function enableCodeBlockCopy(frame: HTMLElement): void {
  const button = frame.querySelector<HTMLButtonElement>('.lc-codeblock-copy')
  if (!button || button.dataset.wired === 'true') return
  const lang = frame.querySelector('.lc-codeblock-lang')?.textContent ?? 'text'
  const source = frame.querySelector('code')?.textContent ?? ''
  button.dataset.wired = 'true'
  button.removeAttribute('aria-disabled')
  wireCopyButton(button, lang, source)
}

export function buildCodeBlockChrome(lang: string, source: string, highlighted: HTMLPreElement): HTMLDivElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'lc-codeblock'

  const header = document.createElement('div')
  header.className = 'lc-codeblock-header'

  const label = document.createElement('span')
  label.className = 'lc-codeblock-lang'
  label.textContent = lang

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'lc-codeblock-copy'
  button.innerHTML = COPY_SVG
  wireCopyButton(button, lang, source)

  header.append(label, button)
  wrapper.append(header, highlighted)
  return wrapper
}

// The pending marker is set synchronously, so the skeleton paints while the
// dynamic `shiki` import is still in flight.
export async function highlightCodeBlocks(container: HTMLElement, signal: AbortSignal): Promise<void> {
  // Scope to base-pipeline HTML only: Mermaid islands render their own
  // <pre> placeholders as siblings, and replacing one of those would
  // detach a node React still owns → removeChild crash on next commit.
  const blocks = container.querySelectorAll('.lc-md pre:not(.shiki) > code, .lc-codeblock pre:not(.shiki) > code')
  if (blocks.length === 0) return
  const pres = Array.from(blocks)
    .map((code) => code.parentElement)
    .filter((pre): pre is HTMLPreElement => pre instanceof HTMLPreElement)
  for (const pre of pres) {
    pre.setAttribute('data-shiki', 'pending')
    pre.setAttribute('aria-busy', 'true')
    const frame = pre.closest<HTMLElement>('.lc-codeblock')
    if (frame) enableCodeBlockCopy(frame)
  }
  const { codeToHtml } = await import('shiki')
  for (const code of Array.from(blocks)) {
    if (signal.aborted) return
    const pre = code.parentElement
    if (!pre) continue
    const match = code.className.match(/language-([\w+#-]+)/)
    const lang = normalizeCodeLanguage(match?.[1])
    const source = code.textContent ?? ''
    if (!source.trim()) {
      pre.removeAttribute('data-shiki')
      pre.removeAttribute('aria-busy')
      continue
    }
    try {
      const html = await codeToHtml(source, {
        lang,
        themes: { light: 'vitesse-light', dark: 'vitesse-dark' },
      })
      if (signal.aborted) return
      const template = document.createElement('template')
      template.innerHTML = html.trim()
      const highlighted = template.content.firstElementChild
      if (highlighted instanceof HTMLPreElement) {
        const frame = pre.closest<HTMLElement>('.lc-codeblock')
        if (frame) {
          pre.replaceWith(highlighted)
          enableCodeBlockCopy(frame)
        } else {
          pre.replaceWith(buildCodeBlockChrome(lang, source, highlighted))
        }
      } else {
        pre.removeAttribute('data-shiki')
        pre.removeAttribute('aria-busy')
      }
    } catch {
      // Unknown language or highlighter failure: clear the pending
      // state and keep base rendering.
      pre.removeAttribute('data-shiki')
      pre.removeAttribute('aria-busy')
    }
  }
}
