import { apiKey } from '@better-auth/api-key'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { getBusinessAuthSettings } from '@/server/auth/business-auth-config'
import type { SessionPrincipal } from '@/server/auth/principal'
import { getAuthSelection } from '@/server/auth/provider-config'
import { createRegisteredOrigins } from '@/server/auth/registered-origins'
import { getBusinessDb } from '@/server/db/business-sql'
import { account, apikey, session, user, verification } from '@/server/db/schema'
import { hasInstanceAdmin } from '@/server/modules/admin/infrastructure/admin-repository'
import { listRegisteredOrigins } from '@/server/modules/comments/infrastructure/site-origin-repository'
import { getRequestLogger } from '@/server/observability/logger'
import { installedOpenApiPlugins } from '@/server/openapi/config'

// Every origin a site has registered. Better Auth checks the Origin header and
// the callbackURL / errorCallbackURL against this list, so a registered site
// can start and finish sign-in without a restart.
const registeredOrigins = createRegisteredOrigins(listRegisteredOrigins, {
  onError: (error) =>
    getRequestLogger().warn('auth.registered-origins.unavailable', {
      errorName: error instanceof Error ? error.name : typeof error,
    }),
})

// Credentialed CORS for /api/auth/* asks the same list: only registered origins
// may read an auth response that carries the user's session.
export function isRegisteredAuthOrigin(origin: string): Promise<boolean> {
  return registeredOrigins.has(origin)
}

// API keys: user-owned, scoped per key. Site tenancy travels in the key's
// metadata ({ siteKey }); permissions use { sites: ['create'], … }.
// Server routes set both via auth.api; clients can never set permissions.
function businessApiKeyPlugin() {
  return apiKey({
    customAPIKeyGetter: (ctx) => {
      const raw = ctx.headers?.get('x-api-key') ?? ctx.headers?.get('authorization')
      if (!raw) return null
      return raw.startsWith('Bearer ') ? raw.slice('Bearer '.length) : raw
    },
    defaultPrefix: 'lck_',
    enableMetadata: true,
    requireName: true,
  })
}

function createBusinessAuth(setup = false) {
  return betterAuth({
    ...getBusinessAuthSettings(undefined, setup),
    database: drizzleAdapter(getBusinessDb(), {
      provider: 'pg',
      schema: { user, session, account, verification, apikey },
    }),
    plugins: [businessApiKeyPlugin(), tanstackStartCookies(), ...installedOpenApiPlugins],
    ...(setup
      ? {}
      : {
          // Better Auth calls this at init without a request; that call gets no
          // origins, so the database is only read for real requests.
          trustedOrigins: async (request?: Request) => (request ? [...(await registeredOrigins.list())] : []),
          databaseHooks: {
            user: {
              create: {
                // Closed by default: the first account arrives via the setup
                // instance (POST /api/initial-admin). AUTH_BOOTSTRAP_EMAIL
                // relaxes this for exactly one address so headless deploys
                // can create their first admin without the setup form.
                before: async (user) => {
                  if (await hasInstanceAdmin()) return
                  const { bootstrapEmail } = getAuthSelection()
                  if (bootstrapEmail && user?.email?.toLowerCase() === bootstrapEmail) return
                  return false
                },
              },
            },
          },
        }),
  })
}

let instance: ReturnType<typeof createBusinessAuth> | undefined
let setupInstance: ReturnType<typeof createBusinessAuth> | undefined

export function getBusinessAuth() {
  if (!instance) instance = createBusinessAuth()
  return instance
}

export function getBusinessSetupAuth() {
  if (!setupInstance) setupInstance = createBusinessAuth(true)
  return setupInstance
}

export async function getBusinessSession(headers: Headers) {
  const auth = getBusinessAuth()
  return auth.api.getSession({ headers })
}

// SessionAdapter entry for the built-in provider. Returns null when no
// session cookie is present; the resolve layer chains this with external
// adapters per AUTH_PROVIDERS order.
export async function resolveBetterAuthSession(request: Request): Promise<SessionPrincipal | null> {
  const session = await getBusinessSession(request.headers)
  if (!session) return null
  return {
    userId: session.user.id,
    email: session.user.email,
    displayName: session.user.name,
    image: session.user.image ?? null,
    credential: { kind: 'session', provider: 'better-auth' },
  }
}
