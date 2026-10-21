// Dates cross the wire as strings, so these client mirrors stay separate
// from the server types.

export type SiteUser = {
  userId: string
  name: string
  email: string
  createdAt: string
  role: 'admin' | 'moderator' | null
  commentsTotal: number
  lastCommentAt: string | null
  blocked: boolean
  blockedReason: string | null
  blockedAt: string | null
}

export type UserCommentHistoryItem = {
  id: string
  pageId: string
  pageTitle: string | null
  canonicalUrl: string
  bodyMarkdown: string
  status: 'visible' | 'hidden' | 'deleted'
  createdAt: string
}

export type UserDirectoryFilter = 'all' | 'blocked'

export type InstanceSettings = {
  plugins: {
    id: string
    apiVersion: number
    enabled: boolean
    detail: string
    events: string[]
    capabilities: { validateComment: boolean; beforeOperation: boolean; handleEvent: boolean }
  }[]
  auth: {
    providers: ('better-auth' | 'oidc-jwt' | 'header')[]
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
