import { isProxySourceAllowed, normalizeAddress, peerAddress } from '@/server/http/proxy-source'

export { peerAddress }

// Ingress we trust to speak for the client. Loopback and RFC1918 cover the
// documented setup (a reverse proxy on the same host or in the container
// network). A public peer is never trusted, so a direct client cannot rotate
// `x-real-ip` to get a fresh rate-limit bucket.
export const DEFAULT_TRUSTED_PROXY_CIDRS = [
  '127.0.0.0/8',
  '::1',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
] as const

export function isTrustedProxy(peer: string, cidrs: readonly string[]): boolean {
  const address = normalizeAddress(peer)
  return cidrs.some((cidr) => isProxySourceAllowed(address, cidr))
}

// The client IP the rate limit buckets on. The ingress headers are honoured
// only when the request came from a trusted ingress; otherwise the peer
// address is the client. Without a peer address (edge runtimes, the dev
// server) the headers are the only signal there is.
//
// Precedence: `CF-Connecting-IP` (Cloudflare's single visitor IP, and the
// only one a Tunnel sets), then `x-real-ip` (the nginx contract), then the
// peer. The Cloudflare header wins because intermediaries commonly inject
// `x-real-ip` with the address they saw, which would mask the visitor.
export function resolveClientIp(request: Request, options: { trustedCidrs?: readonly string[] } = {}): string | null {
  const header = request.headers.get('x-real-ip')?.trim() || null
  const cloudflareHeader = request.headers.get('cf-connecting-ip')?.trim() || null
  const peer = peerAddress(request)
  if (!peer) return cloudflareHeader ?? header
  const cidrs = options.trustedCidrs ?? DEFAULT_TRUSTED_PROXY_CIDRS
  if (!isTrustedProxy(peer, cidrs)) return peer
  return cloudflareHeader ?? header ?? peer
}
