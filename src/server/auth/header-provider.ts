import { linkOrProvisionExternalUser, maybeBootstrapInstanceAdmin } from '@/server/auth/external-identities'
import type { SessionPrincipal } from '@/server/auth/principal'
import { getAuthSelection, getHeaderProviderSettings, type HeaderProviderSettings } from '@/server/auth/provider-config'
import type { getBusinessDb } from '@/server/db/business-sql'
import { isProxySourceAllowed, peerAddress } from '@/server/http/proxy-source'

const PROVIDER = 'header'

type HeaderDeps = {
  settings?: HeaderProviderSettings
  db?: ReturnType<typeof getBusinessDb>
  autoProvision?: boolean
  authFile?: unknown
  remoteAddr?: string | null
}

// Reverse-proxy SSO (Cloudflare Access, Authelia, ...): the proxy authenticates the visitor and forwards
// identity headers. Trust comes from the socket peer only. A forwarded header is written by the client,
// so it never decides who the proxy is. Fails closed: no trust flag, no peer, or a peer outside
// `proxyCidr` returns null. auth.config.ts refuses `proxyCidr: '*'` while trustProxy is on.
export async function resolveHeaderSession(request: Request, deps?: HeaderDeps): Promise<SessionPrincipal | null> {
  const settings = deps?.settings ?? getHeaderProviderSettings(deps?.authFile)
  if (!settings.AUTH_TRUST_PROXY) return null
  const peer = deps?.remoteAddr ?? peerAddress(request)
  if (!peer || !isProxySourceAllowed(peer, settings.AUTH_PROXY_CIDR)) return null

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
      // The trusted proxy vouches for the email. Attaching it to an existing account is still an
      // operator decision (`header.linkByEmail`), because that account then answers to this provider.
      emailVerified: true,
      mergeByEmail: settings.AUTH_LINK_BY_EMAIL,
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
