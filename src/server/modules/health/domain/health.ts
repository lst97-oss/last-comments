export type HealthCheckState = { ok: boolean; latencyMs: number }

export type HealthReport = {
  status: 'ok' | 'degraded'
  timestamp: string
  uptimeSeconds: number
  checks: { database: HealthCheckState }
}

export type LiveReport = {
  status: 'live'
  timestamp: string
  uptimeSeconds: number
}

export function buildHealthReport(input: {
  database: HealthCheckState
  now: Date
  uptimeSeconds: number
}): HealthReport {
  return {
    status: input.database.ok ? 'ok' : 'degraded',
    timestamp: input.now.toISOString(),
    uptimeSeconds: input.uptimeSeconds,
    checks: { database: input.database },
  }
}

export function buildLiveReport(input: { now: Date; uptimeSeconds: number }): LiveReport {
  return {
    status: 'live',
    timestamp: input.now.toISOString(),
    uptimeSeconds: input.uptimeSeconds,
  }
}
