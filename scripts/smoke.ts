export {}

// Boot-contract smoke: the AGENTS.md verification checklist against a running
// server. Usage: bun run smoke [baseUrl] (or SMOKE_BASE_URL env).
const base = (process.argv[2] ?? Bun.env.SMOKE_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')

type Check = { name: string; run: () => Promise<string | null> }
// null = pass, string = failure detail.

async function get(path: string): Promise<Response> {
  return fetch(`${base}${path}`, { redirect: 'manual' })
}

async function bodyText(res: Response): Promise<string> {
  return JSON.stringify(await res.json()).slice(0, 120)
}

const checks: Check[] = [
  {
    name: 'GET / → 200',
    run: async () => {
      const res = await get('/')
      return res.status === 200 ? null : `status ${res.status}`
    },
  },
  {
    name: 'GET /admin → login redirect or 200',
    run: async () => {
      const res = await get('/admin')
      if (res.status === 200) return null
      if ([301, 302, 303, 307, 308].includes(res.status)) return null
      return `status ${res.status}`
    },
  },
  {
    name: 'GET /api/users/me → 200 {"user":null}',
    run: async () => {
      const res = await get('/api/users/me')
      if (res.status !== 200) return `status ${res.status}`
      const body = (await res.json()) as { user?: unknown }
      return body.user === null ? null : `body ${await bodyText(res.clone())}`
    },
  },
  {
    name: 'GET /api/live → 200 live',
    run: async () => {
      const res = await get('/api/live')
      if (res.status !== 200) return `status ${res.status}`
      const body = (await res.json()) as { data?: { status?: unknown } }
      return body.data?.status === 'live' ? null : `body ${await bodyText(res.clone())}`
    },
  },
  {
    name: 'GET /api/ready → 200|503 with report',
    run: async () => {
      const res = await get('/api/ready')
      if (res.status !== 200 && res.status !== 503) return `status ${res.status}`
      const body = (await res.json()) as { data?: { status?: unknown } }
      return body.data?.status === 'ok' || body.data?.status === 'degraded'
        ? null
        : `body ${await bodyText(res.clone())}`
    },
  },
  {
    name: 'GET /docs → 200',
    run: async () => {
      const res = await get('/docs')
      return res.status === 200 ? null : `status ${res.status}`
    },
  },
  {
    name: 'GET /api/openapi.json → 200 with an OpenAPI document',
    run: async () => {
      const res = await get('/api/openapi.json')
      if (res.status !== 200) return `status ${res.status}`
      const body = (await res.json()) as { openapi?: unknown }
      return typeof body.openapi === 'string' && body.openapi.startsWith('3.1')
        ? null
        : `body ${await bodyText(res.clone())}`
    },
  },
]

let failed = 0
for (const check of checks) {
  try {
    const detail = await check.run()
    if (detail === null) console.log(`PASS ${check.name}`)
    else {
      failed += 1
      console.log(`FAIL ${check.name}: ${detail}`)
    }
  } catch (error) {
    failed += 1
    console.log(`FAIL ${check.name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}
if (failed > 0) {
  console.log(`${failed} failing check(s) against ${base}`)
  process.exit(1)
}
console.log(`all smoke checks passed against ${base}`)
