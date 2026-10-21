import type { Filter } from 'bad-words'

// Non-LLM lexical screening via the `bad-words` package. Semantics are kept
// deliberately predictable for moderators:
//   - `blocklist` entries are case-insensitive substring matches.
//   - `allowlist` entries exempt exact tokens (case-insensitive) and are
//     removed from the default wordlist, fixing false positives without
//     forking the library.
//   - the default wordlist is checked per token (unicode word segments).
// Matched terms are redacted to first-letter form (`s***`) before logging.

export type BadwordsScreenResult = { flagged: boolean; matchedTerms: string[] }

export type BadwordsFilter = Pick<Filter, 'isProfane' | 'addWords' | 'removeWords'>

function redact(term: string): string {
  const first = term.trim().slice(0, 1)
  return first === '' ? '***' : `${first}***`
}

function tokensOf(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
}

export function screenBadwords(
  text: string,
  options: { blocklist: readonly string[]; allowlist: readonly string[]; filter: BadwordsFilter },
): BadwordsScreenResult {
  const { blocklist, allowlist, filter } = options
  const allowed = new Set(allowlist.map((entry) => entry.toLowerCase()))
  if (allowed.size > 0) filter.removeWords(...allowed)
  const extra = blocklist.map((entry) => entry.toLowerCase()).filter((entry) => entry !== '' && !allowed.has(entry))
  if (extra.length > 0) filter.addWords(...extra)

  const matched: string[] = []
  const lowered = text.toLowerCase()
  for (const phrase of extra) {
    if (lowered.includes(phrase)) matched.push(redact(phrase))
  }
  for (const token of tokensOf(text)) {
    if (token === '' || allowed.has(token)) continue
    // `extra` phrases are already handled above as substrings; a single-token
    // blocklist entry also matches here, which is intended.
    if (filter.isProfane(token)) matched.push(redact(token))
  }
  return { flagged: matched.length > 0, matchedTerms: [...new Set(matched)] }
}
