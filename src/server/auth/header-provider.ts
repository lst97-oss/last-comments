import { linkOrProvisionExternalUser, maybeBootstrapInstanceAdmin } from '@/server/auth/external-identities'
import type { SessionPrincipal } from '@/server/auth/principal'
import { getAuthSelection, getHeaderProviderSettings, type HeaderProviderSettings } from '@/server/auth/provider-config'
import type { getBusinessDb } from '@/server/db/business-sql'

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
export function isProxySourceAllowed(remoteAddr: string | null | undefined, cidr: string): boolean {
  if (cidr === '*') return true
  if (!remoteAddr) return false
  const addr = remoteAddr.trim()
  if (cidr.includes('/')) {
    const [base, bitsRaw] = cidr.split('/')
    const bits = Number(bitsRaw)
    if (!base || !Number.isInteger(bits)) return false
    if (base.includes(':') || addr.includes(':')) return addr === base
    const toInt = (ip: string): number | null => {
      const parts = ip.split('.').map(Number)
      if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null
      return (
        ((parts[0] as number) * 256 ** 3 +
          (parts[1] as number) * 256 ** 2 +
          (parts[2] as number) * 256 +
          (parts[3] as number)) >>>
        0
      )
    }
    const baseInt = toInt(base)
    const addrInt = toInt(addr)
    if (baseInt === null || addrInt === null || bits < 0 || bits > 32) return false
    const mask = bits === 0 ? 0 : (0xff_ff_ff_ff << (32 - bits)) >>> 0
    return (baseInt & mask) === (addrInt & mask)
  }
  return addr === cidr
}

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
