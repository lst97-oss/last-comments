import { z } from 'zod'
import { COMMENT_BODY_LIMIT } from '@/lib/comment-schema'

export const siteNameSchema = z.string().trim().min(1, 'Enter a site name').max(120)

export const siteFormSchema = z.object({
  name: siteNameSchema,
  // Single total check: z.url() keeps running later checks after it fails, so
  // refining on `new URL` needs its own guard (server schema has the same shape).
  origin: z
    .string()
    .trim()
    .max(2048, 'Origin must be at most 2048 characters')
    .refine((value) => {
      try {
        const url = new URL(value)
        return ['http:', 'https:'].includes(url.protocol) && url.pathname === '/' && !url.search && !url.hash
      } catch {
        return false
      }
    }, 'Enter an origin like https://comments.example.com — scheme and host only'),
})

// The limit field is text, so an empty box can mean "use the default".
export const bodyLimitFieldSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= COMMENT_BODY_LIMIT),
    `Enter a whole number from 1 to ${COMMENT_BODY_LIMIT.toLocaleString()}, or leave it blank for the default`,
  )

export const editSiteSchema = z.object({ name: siteNameSchema, bodyLimit: bodyLimitFieldSchema })

// Blank means the default, which the API stores as null.
export function bodyLimitFromField(value: string): number | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : Number(trimmed)
}

export type SiteForm = z.infer<typeof siteFormSchema>
export type EditSiteForm = z.infer<typeof editSiteSchema>

export const initialAdminSchema = z.strictObject({
  name: z.string().trim().min(1, 'Enter your name').max(120),
  email: z.email('Enter a valid email').max(255),
  password: z.string().min(12, 'Use at least 12 characters').max(128),
})
