import type { NitroAppPlugin } from 'nitro/types'

import { closeBusinessSql } from '@/server/db/business-sql'
import { getRequestLogger } from '@/server/observability/logger'

const logger = getRequestLogger().child({ component: 'shutdown', role: 'app' })

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

// Counts rejections, including the ones nested in destroyCachedPayloads()'s own result list.
export function countFailures(results: PromiseSettledResult<unknown>[]): number {
  return results.reduce((count, result) => {
    if (result.status === 'rejected') return count + 1
    return count + (Array.isArray(result.value) ? countFailures(result.value) : 0)
  }, 0)
}

// Payload caches instances in global._payload with an open Postgres pool each, so the drain must run or
// the pool holds the process open until the platform force-kills it. srvx handles SIGINT/SIGTERM (unless
// CI or TEST is set): it stops accepting, lets in-flight requests finish, then runs Nitro's `close` hook.
// Drain there and exit.
const payloadShutdownPlugin: NitroAppPlugin = (nitroApp) => {
  nitroApp.hooks.hook('close', async () => {
    const startedAt = performance.now()
    // srvx's "Stopping server gracefully" progress line has no newline; end it so the JSON log starts clean.
    process.stderr.write('\n')
    logger.info('shutdown.started')
    const results = await drainAll()
    logger.info('shutdown.drained', {
      durationMs: Math.round(performance.now() - startedAt),
      failed: countFailures(results),
    })
    logger.info('shutdown.exit', { code: 0 })
    process.exit(0)
  })
}

export default payloadShutdownPlugin
