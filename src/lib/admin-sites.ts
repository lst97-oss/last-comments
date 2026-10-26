import { readApiData } from '@/lib/api-response'
import type { SiteAccess } from '@/lib/site-access'

export type SiteRole = 'admin' | 'member'

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
  votesEnabled?: boolean
}

// One query for the sites the viewer can moderate. The dashboard, the
// moderation list and the API-keys page all read it, so they share a single
// cache entry.
export const ADMIN_SITES_QUERY_KEY = ['admin-sites'] as const

export type AdminSites = {
  sites: Site[]
  isInstanceAdmin: boolean
}

export async function fetchAdminSites(): Promise<AdminSites> {
  const response = await fetch('/api/moderation')
  return readApiData<AdminSites>(response)
}
