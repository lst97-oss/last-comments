import { z } from 'zod'

import { siteNameSchema } from '@/lib/site-schema'

export const siteKeyParamSchema = z.string().min(1).max(100)

export const renameBodySchema = z.strictObject({ name: siteNameSchema })

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
