import { z } from 'zod'

// The widest body the server accepts. It is also the default for a site that has
// not set its own limit, so a site can lower the cap but never raise it.
export const COMMENT_BODY_LIMIT = 10_000

// Applies the site's stored limit (null = default) under the server ceiling.
export function resolveBodyLimit(stored: number | null): number {
  return stored === null ? COMMENT_BODY_LIMIT : Math.min(stored, COMMENT_BODY_LIMIT)
}

// For the admin API: a site limit is 1 to the ceiling, or null to reset to the default.
export const siteBodyLimitSchema = z.number().int().min(1).max(COMMENT_BODY_LIMIT)

// The schema-wide ceiling. The cap applies to the raw string, before `.trim()`, so
// the widget's character count matches exactly; the later `.min(1)` still rejects a
// blank body. A site's own limit is data, so it is checked against the stored row.
export const commentBodyMarkdown = z.string().max(COMMENT_BODY_LIMIT).trim().min(1)
