import { z } from 'zod'

import { API_KEY_SCOPES, type ApiKeyScope } from '@/lib/api-key-scopes'
import type { SiteAccess } from '@/lib/site-access'

export type PluginKey = {
  id: string
  name: string | null
  start: string | null
  prefix: string | null
  enabled: boolean
  expiresAt: string | Date | null
  createdAt: string | Date
  metadata: { siteKey?: string } | null
  // The plugin parses the stored JSON text before every read path.
  permissions: Record<string, string[]> | null
}

export type SiteRole = 'admin' | 'moderator'

// Dashboard site shape: /api/moderation adds `role` (membership) and
// /api/admin/sites adds `origins`, so both are optional here.
// `bodyLimit` null is the default (10,000 characters).
export type Site = {
  id: string
  key: string
  name: string
  role?: SiteRole
  origins?: string[]
  bodyLimit?: number | null
  access?: SiteAccess
  gatewayOnly?: boolean
}

// Scopes a key bound to one site can hold, listed in the key editor.
export const SITE_KEY_SCOPES = API_KEY_SCOPES.filter(
  (scope) => scope.startsWith('pages:') || scope.startsWith('comments:'),
)

// The least-privilege default for a new key: register and read that site's page
// threads. Deleting pages stays an explicit grant.
export const DEFAULT_SITE_KEY_SCOPES: ApiKeyScope[] = ['pages:read', 'pages:write']

export const keyFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter a key name').max(120),
  siteKey: z.string().min(1, 'Pick a site'),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1, 'Pick at least one permission'),
})

export type KeyForm = z.infer<typeof keyFormSchema>

export const SCOPE_LABELS: Record<ApiKeyScope, string> = {
  'sites:create': 'Create sites',
  'sites:read': 'List sites',
  'sites:update': 'Rename sites',
  'sites:delete': 'Delete sites',
  'pages:read': 'List the site’s pages',
  'pages:write': 'Register pages',
  'pages:delete': 'Delete pages',
  'comments:read': 'Read comments',
  'comments:write': 'Post and edit comments as guests',
}

export const SCOPE_DESCRIPTIONS: Record<ApiKeyScope, string> = {
  'sites:create': 'Add sites to this instance.',
  'sites:read': 'List the sites on this instance.',
  'sites:update': 'Rename a site.',
  'sites:delete': 'Delete a site and every comment in it.',
  'pages:read': 'List a site’s pages with their comment counts.',
  'pages:write': 'Register a page URL before its first comment.',
  'pages:delete': 'Delete a page, with all its comments, replies and votes. Permanent.',
  'comments:read': 'Load a page’s comments, for a host that proxies them to visitors.',
  'comments:write': 'Post and edit comments on behalf of anonymous visitors. Never acts as a user.',
}

export function scopesEqual(a: readonly ApiKeyScope[], b: readonly ApiKeyScope[]): boolean {
  if (a.length !== b.length) return false
  const known = new Set(b)
  return a.every((scope) => known.has(scope))
}

export function scopesOfKey(key: PluginKey): ApiKeyScope[] {
  const permissions = key.permissions ?? {}
  const scopes: ApiKeyScope[] = []
  for (const scope of API_KEY_SCOPES) {
    const [resource, action] = scope.split(':') as [string, string]
    if (permissions[resource]?.includes(action)) scopes.push(scope)
  }
  return scopes
}
