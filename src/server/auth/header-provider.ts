import { linkOrProvisionExternalUser, maybeBootstrapInstanceAdmin } from '@/server/auth/external-identities'
import type { SessionPrincipal } from '@/server/auth/principal'
import { getAuthSelection, getHeaderProviderSettings, type HeaderProviderSettings } from '@/server/auth/provider-config'
import type { getBusinessDb } from '@/server/db/business-sql'
import { isProxySourceAllowed } from '@/server/http/proxy-source'

const PROVIDER = 'header'

type HeaderDeps = {
  settings?: HeaderProviderSettings
  db?: ReturnType<typeof getBusinessDb>
  autoProvision?: boolean
  authFile?: unknown
  remoteAddr?: string | null
}

// Reverse-proxy SSO (Cloudflare Access, Authelia, Pomeranian...): the proxy
// authenticates and forwards trusted identity headers. Dangerous without
// source checks — requires trustProxy=true in auth.config.ts AND a matching
// proxy CIDR. Fail closed: any misconfiguration returns null instead of
// trusting headers.
export async function resolveHeaderSession(request: Request, deps?: HeaderDeps): Promise<SessionPrincipal | null> {
  const settings = deps?.settings ?? getHeaderProviderSettings(deps?.authFile)
  if (!settings.AUTH_TRUST_PROXY) return null
  // requestIP is not exposed on Request; proxies set x-forwarded-for. Use the
  // last hop (closest proxy) when present, else require wildcard CIDR.
  const forwardedFor = request.headers.get('x-forwarded-for')
  const remoteAddr = deps?.remoteAddr ?? forwardedFor?.split(',').pop()?.trim() ?? null
  if (!isProxySourceAllowed(remoteAddr, settings.AUTH_PROXY_CIDR)) return null

  const subject = request.headers.get(settings.AUTH_HEADER_USER)?.trim()
  if (!subject) return null
  const email = request.headers.get(settings.AUTH_HEADER_EMAIL)?.trim() || null
  const name = request.headers.get(settings.AUTH_HEADER_NAME)?.trim() || null

  const selection = getAuthSelection(deps?.authFile)
  const linked = await linkOrProvisionExternalUser(
    {
      provider: PROVIDER,
      subject,
      email: email?.includes('@') ? email.toLowerCase() : null,
      displayName: name,
      // Proxy headers are trusted by definition (source-checked above), so
      // email may link to an existing user.
      emailVerified: true,
    },
    { db: deps?.db, autoProvision: deps?.autoProvision ?? selection.autoProvision },
  )
  await maybeBootstrapInstanceAdmin(linked.userId, linked.email, {
    db: deps?.db,
    bootstrapEmail: selection.bootstrapEmail,
  })
  return {
    userId: linked.userId,
    email: linked.email,
    displayName: linked.displayName,
    image: null,
    credential: { kind: 'external', provider: PROVIDER, subject },
  }
}
