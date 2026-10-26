import { z } from 'zod'

import { siteBodyLimitSchema } from '@/lib/comment-schema'
import { SITE_ACCESS_LEVELS } from '@/lib/site-access'
import { siteNameSchema } from '@/lib/site-schema'

export const siteKeyParamSchema = z.string().min(1).max(100)

// Partial update: at least one field is required (checked by the repository, so
// the body stays a plain object for OpenAPI). `bodyLimit: null` resets to the default.
export const siteUpdateSchema = z.strictObject({
  name: siteNameSchema.optional(),
  bodyLimit: siteBodyLimitSchema.nullable().optional(),
  access: z.enum(SITE_ACCESS_LEVELS).optional(),
  gatewayOnly: z.boolean().optional(),
  votesEnabled: z.boolean().optional(),
})

export const adminSiteSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  origin: z
    .url()
    .max(2048)
    .transform((value, context) => {
      try {
        const url = new URL(value)
        if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
          context.addIssue({ code: 'custom', message: 'Origin must be an HTTP or HTTPS origin without a path' })
          return z.NEVER
        }
        return url.origin
      } catch {
        context.addIssue({ code: 'custom', message: 'Origin must be an HTTP or HTTPS origin without a path' })
        return z.NEVER
      }
    }),
})
