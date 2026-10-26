// Dates cross the wire as strings, so these client mirrors stay separate
// from the server types.

export type SiteUser = {
  userId: string
  name: string
  email: string
  createdAt: string
  role: 'admin' | 'member'
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

export type UserDirectoryState = {
  search: string
  filter: UserDirectoryFilter
  directoryPage: number
  blockedPage: number
}

export type UserDirectoryAction =
  | { type: 'search'; search: string }
  | { type: 'filter'; filter: UserDirectoryFilter }
  | { type: 'directoryPage'; page: number }
  | { type: 'blockedPage'; page: number }

export const INITIAL_USER_DIRECTORY: UserDirectoryState = {
  search: '',
  filter: 'all',
  directoryPage: 0,
  blockedPage: 0,
}

// A new search or filter changes which rows match, so the page the list was on may no longer exist.
export function userDirectoryReducer(state: UserDirectoryState, action: UserDirectoryAction): UserDirectoryState {
  switch (action.type) {
    case 'search':
      return { ...state, search: action.search, directoryPage: 0, blockedPage: 0 }
    case 'filter':
      return { ...state, filter: action.filter, directoryPage: 0 }
    case 'directoryPage':
      return { ...state, directoryPage: action.page }
    case 'blockedPage':
      return { ...state, blockedPage: action.page }
  }
}

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
