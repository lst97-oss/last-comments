import { readApiData } from '@/lib/api-response'
import { type Site } from '@/lib/site-keys'

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
