export type RegisteredOriginSource = () => Promise<readonly string[]>

export type RegisteredOriginsOptions = {
  ttlMs?: number
  now?: () => number
  onError?: (error: unknown) => void
}

export type RegisteredOrigins = {
  list: () => Promise<readonly string[]>
  has: (origin: string) => Promise<boolean>
}

const DEFAULT_TTL_MS = 30_000

// Short-lived snapshot of the origins sites have registered. Sign-in and
// credentialed CORS read it on every auth request, so a new site works within
// the TTL without a restart. A failed read keeps the last good snapshot, or
// none at all: an outage narrows trust, it never widens it.
export function createRegisteredOrigins(
  source: RegisteredOriginSource,
  options: RegisteredOriginsOptions = {},
): RegisteredOrigins {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
  const now = options.now ?? Date.now
  let snapshot: { at: number; origins: readonly string[] } | null = null
  let inflight: Promise<readonly string[]> | null = null

  function refresh(): Promise<readonly string[]> {
    if (!inflight) {
      inflight = source()
        .then((origins) => {
          snapshot = { at: now(), origins: [...origins] }
          return snapshot.origins
        })
        .catch((error: unknown) => {
          options.onError?.(error)
          return snapshot?.origins ?? []
        })
        .finally(() => {
          inflight = null
        })
    }
    return inflight
  }

  async function list(): Promise<readonly string[]> {
    if (snapshot && now() - snapshot.at < ttlMs) return snapshot.origins
    return refresh()
  }

  return {
    list,
    async has(origin) {
      return (await list()).includes(origin)
    },
  }
}
