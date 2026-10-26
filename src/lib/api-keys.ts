import { z } from 'zod'

import { API_KEY_SCOPES, type ApiKeyScope } from '@/lib/api-key-scopes'
import { anonymousAllowed, type SiteAccess } from '@/lib/site-access'

// The public API key guide (content/docs/api-keys.mdx), and the section the admin help links to.
export const API_KEY_GUIDE_PATH = '/docs/api-keys'
export const API_KEY_GUIDE_SITE_SECTION = 'permissions-by-site-setting'

// An API key as the plugin lists it. The plugin parses the stored permissions JSON before every read.
export type ApiKeyRecord = {
  id: string
  name: string | null
  start: string | null
  prefix: string | null
  enabled: boolean
  expiresAt: string | Date | null
  createdAt: string | Date
  // A site-bound key carries its site's public key here. Instance keys carry no metadata.
  metadata: { site?: string } | null
  permissions: Record<string, string[]> | null
}

// Scopes a site-bound API key can hold, listed in the permission picker.
export const SITE_BOUND_SCOPES = API_KEY_SCOPES.filter(
  (scope) => scope.startsWith('pages:') || scope.startsWith('comments:'),
)

// The least-privilege default for a new key: register and read that site's page
// threads. Deleting pages stays an explicit grant.
export const DEFAULT_API_KEY_SCOPES: ApiKeyScope[] = ['pages:read', 'pages:write']

// The lifetime of a new key, as the API takes it: seconds, or "never" for no expiry.
export const apiKeyExpirySchema = z.enum(['31536000', '7776000', 'never'])
export type ApiKeyExpiry = z.infer<typeof apiKeyExpirySchema>
export const DEFAULT_API_KEY_EXPIRY: ApiKeyExpiry = '31536000'
export const API_KEY_EXPIRY_OPTIONS: { value: ApiKeyExpiry; label: string }[] = [
  { value: '31536000', label: '1 year (recommended)' },
  { value: '7776000', label: '90 days' },
  { value: 'never', label: 'Never expires' },
]

export function expiresInFor(expiry: ApiKeyExpiry): number | undefined {
  return expiry === 'never' ? undefined : Number(expiry)
}

export const apiKeyFormSchema = z.object({
  name: z.string().trim().min(1, 'Enter a key name').max(120),
  siteKey: z.string().min(1, 'Pick a site'),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1, 'Pick at least one permission'),
  expiry: apiKeyExpirySchema,
})

export type ApiKeyForm = z.infer<typeof apiKeyFormSchema>

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

export type ScopeResource = 'comments' | 'pages'

// The manual scope list groups by resource and separates the groups.
export const SCOPE_GROUPS: readonly { resource: ScopeResource; label: string; scopes: ApiKeyScope[] }[] = [
  {
    resource: 'comments',
    label: 'Comments',
    scopes: SITE_BOUND_SCOPES.filter((scope) => scope.startsWith('comments:')),
  },
  { resource: 'pages', label: 'Pages', scopes: SITE_BOUND_SCOPES.filter((scope) => scope.startsWith('pages:')) },
]

// What a key is for, in plain words. Ticking a feature grants the scopes it needs,
// so permissions follow the job the key does instead of being picked one by one.
export type ApiKeyFeature = {
  id: string
  resource: ScopeResource
  label: string
  description: string
  scopes: ApiKeyScope[]
}

export const API_KEY_FEATURES: readonly ApiKeyFeature[] = [
  {
    id: 'show-comments',
    resource: 'comments',
    label: 'Show comments on pages',
    description: 'Let your server load a page’s comments for its visitors.',
    scopes: ['comments:read'],
  },
  {
    id: 'post-comments',
    resource: 'comments',
    label: 'Post comments for visitors',
    description: 'Let your server post and edit guest comments. The key never acts as a user.',
    scopes: ['comments:write'],
  },
  {
    id: 'read-pages',
    resource: 'pages',
    label: 'Read pages and comment counts',
    description: 'List a site’s pages and their stats, for a dashboard or sync job.',
    scopes: ['pages:read'],
  },
  {
    id: 'register-pages',
    resource: 'pages',
    label: 'Register new pages',
    description: 'Create a page’s thread before its first comment arrives.',
    scopes: ['pages:write'],
  },
  {
    id: 'delete-pages',
    resource: 'pages',
    label: 'Delete pages',
    description: 'Removes a page with every comment, reply and vote. Permanent.',
    scopes: ['pages:delete'],
  },
]

export function featureOn(scopes: readonly ApiKeyScope[], feature: ApiKeyFeature): boolean {
  return feature.scopes.every((scope) => scopes.includes(scope))
}

export function toggleFeatureIn(scopes: readonly ApiKeyScope[], feature: ApiKeyFeature): ApiKeyScope[] {
  if (featureOn(scopes, feature)) return scopes.filter((scope) => !feature.scopes.includes(scope))
  return [...new Set([...scopes, ...feature.scopes])]
}

export function toggleScopeIn(scopes: readonly ApiKeyScope[], scope: ApiKeyScope): ApiKeyScope[] {
  return scopes.includes(scope) ? scopes.filter((item) => item !== scope) : [...scopes, scope]
}

// The comment scopes a site's key needs: the operations its visitors cannot do without one. An open site
// needs none, because anonymous visitors already read and post. A gateway-only site refuses every caller
// without a key, so its key needs both.
export function requiredCommentScopes(site: { access?: SiteAccess; gatewayOnly?: boolean }): ApiKeyScope[] {
  if (site.gatewayOnly) return ['comments:read', 'comments:write']
  const access = site.access ?? 'open'
  const scopes: ApiKeyScope[] = []
  if (!anonymousAllowed(access, 'read')) scopes.push('comments:read')
  if (!anonymousAllowed(access, 'write')) scopes.push('comments:write')
  return scopes
}

// Sets the comment scopes to what the site needs and keeps the page scopes the user chose.
export function scopesForSite(
  scopes: readonly ApiKeyScope[],
  site: { access?: SiteAccess; gatewayOnly?: boolean },
): ApiKeyScope[] {
  return [...requiredCommentScopes(site), ...scopes.filter((scope) => !scope.startsWith('comments:'))]
}

export function scopesEqual(a: readonly ApiKeyScope[], b: readonly ApiKeyScope[]): boolean {
  if (a.length !== b.length) return false
  const known = new Set(b)
  return a.every((scope) => known.has(scope))
}

export function scopesOfKey(key: ApiKeyRecord): ApiKeyScope[] {
  const permissions = key.permissions ?? {}
  const scopes: ApiKeyScope[] = []
  for (const scope of API_KEY_SCOPES) {
    const [resource, action] = scope.split(':') as [string, string]
    if (permissions[resource]?.includes(action)) scopes.push(scope)
  }
  return scopes
}
