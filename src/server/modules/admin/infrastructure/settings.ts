import { getAuthSelection, getHeaderProviderSettings, getOidcSettings } from '@/server/auth/provider-config'
import { getCommentEditSettings, getCommentPluginSettings, getCommentPlugins } from '@/server/plugins/comment-plugins'
import { getFilterSettings } from '@/server/plugins/filter/filter.plugin'
import { getRateLimitPluginSettings, rateLimits } from '@/server/plugins/rate-limit/rate-limit.config'
import { getTurnstilePluginSettings } from '@/server/plugins/turnstile/turnstile.config'

// Read-only instance snapshot; secrets are reported as configured booleans.
export type PluginStatus = {
  id: string
  apiVersion: number
  enabled: boolean
  detail: string
  events: string[]
  capabilities: { validateComment: boolean; beforeOperation: boolean; handleEvent: boolean }
}

export type InstanceSettings = {
  plugins: PluginStatus[]
  auth: {
    providers: string[]
    autoProvision: boolean
    bootstrapEmailSet: boolean
    oidc: { configured: boolean; jwksUrlSet: boolean; issuerSet: boolean; audienceSet: boolean }
    header: {
      trustProxy: boolean
      cidr: string
      userHeader: string
      emailHeader: string
      nameHeader: string
    }
  }
  comments: {
    verificationRequired: boolean
    turnstileSecretConfigured: boolean
    turnstileSiteKeyConfigured: boolean
    anonEditWindowMinutes: number
  }
  rateLimit: {
    secretConfigured: boolean
    limits: { operation: string; count: number; windowSeconds: number }[]
  }
}

function nonEmpty(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0
}

function defaultEnv(): Record<string, string | undefined> {
  return typeof Bun !== 'undefined' ? Bun.env : process.env
}

export function getInstanceSettings(overrides: { env?: Record<string, string | undefined> } = {}): InstanceSettings {
  const env = overrides.env ?? defaultEnv()
  const auth = getAuthSelection()
  const header = getHeaderProviderSettings()
  const pluginSettings = getCommentPluginSettings()
  const turnstile = getTurnstilePluginSettings({ env })
  const rateLimit = getRateLimitPluginSettings(env)
  const filter = getFilterSettings(env)
  const edit = getCommentEditSettings()

  let oidcConfigured = false
  try {
    getOidcSettings(undefined, env)
    oidcConfigured = true
  } catch {
    oidcConfigured = false
  }

  const turnstileSecretConfigured = nonEmpty(turnstile.secretKey)
  const turnstileEnabled = pluginSettings.verificationRequired && turnstileSecretConfigured
  const rateLimitEnabled = nonEmpty(rateLimit.secret)

  const plugins: PluginStatus[] = getCommentPlugins().map((plugin) => {
    const capabilities = {
      validateComment: plugin.validateComment !== undefined,
      beforeOperation: plugin.beforeOperation !== undefined,
      handleEvent: plugin.handleEvent !== undefined,
    }
    if (plugin.id === 'turnstile') {
      const detail = !pluginSettings.verificationRequired
        ? 'Comment verification is bypassed (local development only)'
        : turnstileSecretConfigured
          ? 'Comments require a Turnstile token'
          : 'Comment verification is required but TURNSTILE_SECRET_KEY is missing — posts fail closed'
      return {
        id: plugin.id,
        apiVersion: plugin.apiVersion,
        enabled: turnstileEnabled,
        detail,
        events: [...(plugin.events ?? [])],
        capabilities,
      }
    }
    if (plugin.id === 'rate-limit') {
      return {
        id: plugin.id,
        apiVersion: plugin.apiVersion,
        enabled: rateLimitEnabled,
        detail: rateLimitEnabled
          ? 'Request quotas are enforced per operation and identity'
          : 'BETTER_AUTH_SECRET is missing — comment operations fail closed instead of rate-limiting',
        events: [...(plugin.events ?? [])],
        capabilities,
      }
    }
    if (plugin.id === 'filter') {
      const llmMissingKey = filter.llmEnabled && !filter.openrouter.apiKey
      return {
        id: plugin.id,
        apiVersion: plugin.apiVersion,
        enabled: filter.enabled,
        detail: !filter.enabled
          ? 'Screening is off in filter.config.ts'
          : llmMissingKey
            ? 'Screening is active, but OPENROUTER_API_KEY is missing — LLM checks fail open'
            : 'Screening is active; violations are held for review',
        events: [...(plugin.events ?? [])],
        capabilities,
      }
    }
    return {
      id: plugin.id,
      apiVersion: plugin.apiVersion,
      enabled: true,
      detail: 'Installed and active',
      events: [...(plugin.events ?? [])],
      capabilities,
    }
  })

  return {
    plugins,
    auth: {
      providers: auth.providers,
      autoProvision: auth.autoProvision,
      bootstrapEmailSet: nonEmpty(auth.bootstrapEmail),
      oidc: {
        configured: oidcConfigured,
        jwksUrlSet: nonEmpty(env.AUTH_OIDC_JWKS_URL),
        issuerSet: nonEmpty(env.AUTH_OIDC_ISSUER),
        audienceSet: nonEmpty(env.AUTH_OIDC_AUDIENCE),
      },
      header: {
        trustProxy: header.AUTH_TRUST_PROXY,
        cidr: header.AUTH_PROXY_CIDR,
        userHeader: header.AUTH_HEADER_USER,
        emailHeader: header.AUTH_HEADER_EMAIL,
        nameHeader: header.AUTH_HEADER_NAME,
      },
    },
    comments: {
      verificationRequired: pluginSettings.verificationRequired,
      turnstileSecretConfigured,
      turnstileSiteKeyConfigured: nonEmpty(turnstile.siteKey),
      anonEditWindowMinutes: edit.anonWindowMinutes,
    },
    rateLimit: {
      secretConfigured: rateLimitEnabled,
      limits: Object.entries(rateLimits).map(([operation, limit]) => ({ operation, ...limit })),
    },
  }
}
