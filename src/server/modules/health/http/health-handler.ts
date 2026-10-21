import { getBusinessSql } from '@/server/db/business-sql'
import { ok } from '@/server/http/response'
import type { DbProbe } from '@/server/modules/health/application/get-health'
import { getHealth } from '@/server/modules/health/application/get-health'
import type { HealthReport, LiveReport } from '@/server/modules/health/domain/health'
import { buildLiveReport } from '@/server/modules/health/domain/health'
import { createBunSqlDbProbe } from '@/server/modules/health/infrastructure/db-probe'

// Liveness is unauthenticated by design and never touches the database:
// load-balancer / orchestrator liveness probes must reach it even during a
// DB outage. Readiness below is the DB-backed probe — 503 when degraded,
// so never use it for liveness. Body carries no secrets.

export async function getLiveData(deps?: { now?: () => Date; uptimeSeconds?: () => number }): Promise<LiveReport> {
  return buildLiveReport({
    now: deps?.now?.() ?? new Date(),
    uptimeSeconds: deps?.uptimeSeconds?.() ?? Math.floor(process.uptime()),
  })
}

export async function getReadyData(deps?: { dbProbe?: DbProbe }): Promise<HealthReport> {
  return getHealth({ dbProbe: deps?.dbProbe ?? createBunSqlDbProbe(getBusinessSql()) })
}

export async function handleReadyGet(deps?: { dbProbe?: DbProbe }): Promise<Response> {
  const report = await getReadyData(deps)
  return ok(report, { status: report.status === 'ok' ? 200 : 503 })
}
