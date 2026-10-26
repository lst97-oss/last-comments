import { linkOrProvisionExternalUser, maybeBootstrapInstanceAdmin } from '@/server/auth/external-identities'
import type { SessionPrincipal } from '@/server/auth/principal'
import { getAuthSelection, getOidcSettings, type OidcSettings } from '@/server/auth/provider-config'
import type { getBusinessDb } from '@/server/db/business-sql'

type Jwk = JsonWebKey & { kid?: string; alg?: string; kty?: string }
type JwksDocument = { keys?: Jwk[] }

type VerifyDeps = {
  settings?: OidcSettings
  jwksFetcher?: (url: string) => Promise<JwksDocument>
  nowMs?: number
}

const PROVIDER = 'oidc-jwt'
const SUPPORTED_ALGS = new Set(['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'])
const JWKS_TTL_MS = 10 * 60 * 1000

let jwksCache: { url: string; keys: Jwk[]; fetchedAt: number } | null = null

export function clearOidcCache(): void {
  jwksCache = null
}

function base64UrlDecode(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function hashForAlg(alg: string): string {
  if (alg.endsWith('384')) return 'SHA-384'
  if (alg.endsWith('512')) return 'SHA-512'
  return 'SHA-256'
}

async function importJwk(jwk: Jwk, alg: string): Promise<CryptoKey> {
  if (jwk.kty === 'RSA') {
    return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: hashForAlg(alg) }, false, ['verify'])
  }
  if (jwk.kty === 'EC') {
    return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: jwk.crv ?? 'P-256' }, false, ['verify'])
  }
  throw new Error(`Unsupported JWK kty: ${jwk.kty}`)
}

export async function verifyOidcJwt(
  token: string,
  jwks: JwksDocument,
  settings: OidcSettings,
  nowMs: number = Date.now(),
): Promise<{ sub: string; email: string | null; emailVerified: boolean; name: string | null; image: string | null }> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Malformed JWT')
  const [headerB64, payloadB64, signatureB64] = parts as [string, string, string]
  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64))) as { alg?: string; kid?: string }
  if (!header.alg || !SUPPORTED_ALGS.has(header.alg)) throw new Error(`Unsupported JWT alg: ${header.alg}`)
  const keys = jwks.keys ?? []
  const candidates = header.kid ? keys.filter((key) => key.kid === header.kid) : keys
  if (candidates.length === 0) throw new Error('Unknown key id')
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as Record<string, unknown>

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  const signature = Uint8Array.from(base64UrlDecode(signatureB64))
  let verified = false
  for (const jwk of candidates) {
    try {
      const key = await importJwk(jwk, header.alg)
      const algorithm = jwk.kty === 'EC' ? { name: 'ECDSA', hash: hashForAlg(header.alg) } : 'RSASSA-PKCS1-v1_5'
      if (await crypto.subtle.verify(algorithm, key, signature, data)) {
        verified = true
        break
      }
    } catch {}
  }
  if (!verified) throw new Error('Invalid JWT signature')

  if (typeof payload.iss !== 'string' || payload.iss !== settings.AUTH_OIDC_ISSUER) throw new Error('Invalid issuer')
  const aud = payload.aud
  const audOk =
    typeof aud === 'string'
      ? aud === settings.AUTH_OIDC_AUDIENCE
      : Array.isArray(aud) && aud.includes(settings.AUTH_OIDC_AUDIENCE)
  if (!audOk) throw new Error('Invalid audience')
  const skew = settings.AUTH_OIDC_CLOCK_SKEW_SECONDS * 1000
  if (typeof payload.exp !== 'number' || payload.exp * 1000 + skew <= nowMs) throw new Error('Token expired')
  if (typeof payload.nbf === 'number' && payload.nbf * 1000 - skew > nowMs) throw new Error('Token not yet valid')
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) throw new Error('Missing subject')

  const emailClaim = settings.AUTH_OIDC_EMAIL_CLAIM
  const email = typeof payload[emailClaim] === 'string' ? (payload[emailClaim] as string) : null
  const emailVerified = payload.email_verified === true || payload.emailVerified === true
  const name = typeof payload.name === 'string' ? (payload.name as string) : null
  const image = typeof payload.picture === 'string' ? (payload.picture as string) : null
  return { sub: payload.sub as string, email, emailVerified, name, image }
}

async function loadJwks(url: string, fetcher: (url: string) => Promise<JwksDocument>): Promise<Jwk[]> {
  const cached = jwksCache
  if (cached && cached.url === url && Date.now() - cached.fetchedAt < JWKS_TTL_MS) return cached.keys
  const document = await fetcher(url)
  const keys = document.keys ?? []
  jwksCache = { url, keys, fetchedAt: Date.now() }
  return keys
}

function extractBearer(request: Request): string | null {
  const raw = request.headers.get('authorization')
  if (!raw?.startsWith('Bearer ')) return null
  const token = raw.slice('Bearer '.length).trim()
  return token ? token : null
}

function defaultJwksFetcher(url: string): Promise<JwksDocument> {
  return fetch(url, { headers: { accept: 'application/json' } }).then(async (response) => {
    if (!response.ok) throw new Error(`JWKS fetch failed: ${response.status}`)
    return (await response.json()) as JwksDocument
  })
}

// SessionAdapter entry: verifies the bearer JWT, then links/provisions the
// canonical user. Returns null (not throws) when no bearer token is present;
// throws on invalid tokens so failures are visible as 401s upstream.
export async function resolveOidcSession(
  request: Request,
  deps?: VerifyDeps & {
    db?: ReturnType<typeof getBusinessDb>
    autoProvision?: boolean
    authFile?: unknown
  },
): Promise<SessionPrincipal | null> {
  const token = extractBearer(request)
  if (!token) return null
  const settings = deps?.settings ?? getOidcSettings(deps?.authFile)
  const fetcher = deps?.jwksFetcher ?? defaultJwksFetcher
  const nowMs = deps?.nowMs ?? Date.now()

  let keys = await loadJwks(settings.AUTH_OIDC_JWKS_URL, fetcher)
  let claims: Awaited<ReturnType<typeof verifyOidcJwt>>
  try {
    claims = await verifyOidcJwt(token, { keys }, settings, nowMs)
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'Unknown key id') throw error
    // Key rotation: refresh once and retry before failing.
    jwksCache = null
    keys = await loadJwks(settings.AUTH_OIDC_JWKS_URL, fetcher)
    claims = await verifyOidcJwt(token, { keys }, settings, nowMs)
  }

  const selection = getAuthSelection(deps?.authFile)
  const linked = await linkOrProvisionExternalUser(
    {
      provider: PROVIDER,
      subject: claims.sub,
      email: claims.email,
      displayName: claims.name,
      emailVerified: claims.emailVerified,
      // The IdP asserted the email is verified, so it may attach to an existing account.
      mergeByEmail: claims.emailVerified,
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
    image: claims.image,
    credential: { kind: 'external', provider: PROVIDER, subject: claims.sub },
  }
}
