// Who may read and write a site's comments. `open` is today's behaviour: public
// reads, and writes from any registered Origin. `login` lets anyone read but
// requires a credential to write. `private` requires a credential for both.
// A credential is a comments-service session or a site-bound service key.
export const SITE_ACCESS_LEVELS = ['open', 'login', 'private'] as const
export type SiteAccess = (typeof SITE_ACCESS_LEVELS)[number]
export type AccessOperation = 'read' | 'write'

export function anonymousAllowed(access: SiteAccess, operation: AccessOperation): boolean {
  if (access === 'open') return true
  if (access === 'login') return operation === 'read'
  return false
}
