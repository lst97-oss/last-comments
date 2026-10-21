import { z } from 'zod'

export const COMMENT_BODY_LIMIT = 10_000

// The cap applies to the raw string, before `.trim()`, so the widget's character
// count matches exactly; the later `.min(1)` still rejects a blank body.
export const commentBodyMarkdown = z.string().max(COMMENT_BODY_LIMIT).trim().min(1)
