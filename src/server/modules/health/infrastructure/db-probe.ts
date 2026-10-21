import type { DbProbe } from '@/server/modules/health/application/get-health'
import type { HealthCheckState } from '@/server/modules/health/domain/health'

// Never rejects (see AGENTS.md): errors/timeouts resolve to `{ ok: false }`.

const DB_PROBE_TIMEOUT_MS = 2000

export function createBunSqlDbProbe(client: { unsafe: (sql: string) => Promise<unknown> }): DbProbe {
  return async (): Promise<HealthCheckState> => {
    const started = Date.now()
    const { promise: timeout, resolve: fireTimeout } = Promise.withResolvers<'timeout'>()
    const timer = setTimeout(() => fireTimeout('timeout'), DB_PROBE_TIMEOUT_MS)
    try {
      const result = await Promise.race([client.unsafe('SELECT 1').then(() => 'alive' as const), timeout])
      return { ok: result === 'alive', latencyMs: Date.now() - started }
    } catch {
      return { ok: false, latencyMs: Date.now() - started }
    } finally {
      clearTimeout(timer)
    }
  }
}
