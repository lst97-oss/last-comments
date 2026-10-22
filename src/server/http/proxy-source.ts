// CIDR matching for trusted ingress (reverse-proxy) addresses. Shared by the
// header SSO provider and the rate-limit client-IP resolver, so it lives in
// a leaf module neither of them has to be imported from.

// Node reports IPv4 peers as IPv4-mapped IPv6 ("::ffff:10.1.2.3"). Normalize
// so a mapped address matches the IPv4 CIDR it really is.
export function normalizeAddress(address: string): string {
  const trimmed = address.trim()
  return trimmed.startsWith('::ffff:') && trimmed.includes('.') ? trimmed.slice('::ffff:'.length) : trimmed
}

// `cidr` is a single CIDR ("10.0.0.0/8"), a single address ("10.1.2.3") or
// "*" (trust every source). Fails closed: an unknown address never matches a
// network and only "*" matches everything.
export function isProxySourceAllowed(remoteAddr: string | null | undefined, cidr: string): boolean {
  if (cidr === '*') return true
  if (!remoteAddr) return false
  const addr = normalizeAddress(remoteAddr)
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
    return (addrInt & mask) === (baseInt & mask)
  }
  return addr === cidr
}
