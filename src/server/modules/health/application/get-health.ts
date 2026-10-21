import type { HealthCheckState, HealthReport } from '@/server/modules/health/domain/health'
import { buildHealthReport } from '@/server/modules/health/domain/health'

export type DbProbe = () => Promise<HealthCheckState>

export type GetHealthDeps = {
  dbProbe: DbProbe
  now?: () => Date
  uptimeSeconds?: () => number
}

export async function getHealth(deps: GetHealthDeps): Promise<HealthReport> {
  const database = await deps.dbProbe()
  return buildHealthReport({
    database,
    now: deps.now?.() ?? new Date(),
    uptimeSeconds: deps.uptimeSeconds?.() ?? Math.floor(process.uptime()),
  })
}
