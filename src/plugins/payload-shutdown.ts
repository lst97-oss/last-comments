import type { NitroAppPlugin } from 'nitro/types'

import { closeBusinessSql } from '@/server/db/business-sql'

type Destroyable = { destroy?: () => unknown }

function cachedPayloads(): unknown[] {
  const cache = (globalThis as Record<string, unknown>)._payload
  if (cache instanceof Map) return [...cache.values()]
  return []
}

export async function destroyCachedPayloads(): Promise<PromiseSettledResult<unknown>[]> {
  return Promise.allSettled(
    cachedPayloads().map(async (payload) => {
      const destroy = (payload as Destroyable | null | undefined)?.destroy
      if (typeof destroy === 'function') await destroy.call(payload)
    }),
  )
}

export async function drainAll(
  closeBusinessPool: () => Promise<void> = closeBusinessSql,
): Promise<PromiseSettledResult<unknown>[]> {
  // allSettled: a failing business-client close never masks payload results.
  return Promise.allSettled([destroyCachedPayloads(), closeBusinessPool()])
}

let shutdownArmed = false

function armProcessHandlers(): void {
  // Bun's serve() does not translate SIGTERM/SIGINT into Nitro's `close`,
  // so trap the signals here, drain, then exit. Idempotent with the hook.
  if (shutdownArmed || typeof process === 'undefined') return
  shutdownArmed = true
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void drainAll().finally(() => process.exit(0))
    })
  }
}

// Payload caches instances in global._payload with an open Postgres pool
// each — without this drain, the pool holds the process open until the
// platform force-kills it, dropping in-flight work.
const payloadShutdownPlugin: NitroAppPlugin = (nitroApp) => {
  armProcessHandlers()
  nitroApp.hooks.hook('close', () => drainAll())
}

export default payloadShutdownPlugin
