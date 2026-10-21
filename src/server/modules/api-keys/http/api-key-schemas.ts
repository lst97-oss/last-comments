import { z } from 'zod'

import { API_KEY_SCOPES } from '@/lib/api-key-scopes'

// Request schemas for the API-key management routes. They live here (not in
// the route file) so the OpenAPI registry can document the exact schemas the
// API validates against.
export const scopeSchema = z.enum(API_KEY_SCOPES)

export const createBodySchema = z.strictObject({
  siteKey: z.string().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(120),
  scopes: z.array(scopeSchema).min(1).max(5),
  expiresIn: z.number().int().positive().optional(),
})

export const scopesBodySchema = z.strictObject({
  keyId: z.string().min(1).max(255),
  siteKey: z.string().min(1).max(100).optional(),
  scopes: z.array(scopeSchema).min(1).max(5).optional(),
  enabled: z.boolean().optional(),
})

export const deleteQuerySchema = z.strictObject({
  keyId: z.string().min(1).max(255),
  siteKey: z.string().min(1).max(100).optional(),
})
