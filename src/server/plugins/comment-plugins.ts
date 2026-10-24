import { HttpError } from '@/server/http/errors'
import { getCommentEditSettings } from '@/server/plugins/comment-policy.config'
import { installedCommentPlugins } from '@/server/plugins/config'
import { getTurnstilePluginSettings } from '@/server/plugins/turnstile/turnstile.config'

export type CommentEventType =
  | 'comment.created'
  | 'comment.edited'
  | 'comment.hidden'
  | 'comment.deleted'
  | 'comment.restored'
  | 'comment.pinned'
  | 'page.locked'
  | 'page.unlocked'
  | 'page.deleted'
  | 'user.blocked'
  | 'user.unblocked'
  | 'user.verified'
  | 'user.unverified'

export type CommentValidationInput = {
  siteId: string
  pageUrl: string
  userId: string | null
  authorName: string
  bodyMarkdown: string
  verificationToken?: string
  // Present on creates (top-level vs reply context for the decider); edits
  // screen with the body only and leave this undefined.
  parentId?: string
}

export type CommentPluginEvent = {
  id: string
  siteId: string
  type: CommentEventType
  apiVersion: 1
  aggregateId: string
  occurredAt: string
  payload: Record<string, unknown>
  signal: AbortSignal
}

export type CommentOperation = 'comment.create' | 'comment.edit' | 'comment.delete' | 'comment.vote'
export type CommentOperationInput = {
  operation: CommentOperation
  siteKey: string
  userId: string | null
  // Set only for a verified service key that names the visitor it acts for
  // (the host's proxy). Plugins may bucket by it; never trust it otherwise.
  clientId?: string
  // The verified key itself: the rate-limit bucket when no clientId is given.
  keyId?: string
  request: Request
}

export type CommentPlugin = {
  id: string
  apiVersion: 1
  events?: readonly CommentEventType[]
  verificationProvider?: boolean
  validateComment?: (input: CommentValidationInput, signal: AbortSignal) => Promise<void>
  // Advisory screening: returns `hide` to hold the comment for review instead
  // of throwing. Unlike `validateComment` it never rejects the write — a
  // `hide` verdict persists the row with `status: 'hidden'`.
  screenComment?: (input: CommentValidationInput, signal: AbortSignal) => Promise<ScreenVerdict>
  beforeOperation?: (input: CommentOperationInput, signal: AbortSignal) => Promise<void>
  migrations?: { folder: string; schema: string }
  handleEvent?: (event: CommentPluginEvent) => Promise<void>
}

export type ScreenVerdict = {
  decision: 'allow' | 'hide'
  reasons: string[]
  triggeredCategories: string[]
  detail?: Record<string, unknown>
}

const COMMENT_VALIDATION_TIMEOUT_MS = 5_000

export function getCommentPluginSettings(overrides: { file?: unknown; env?: Record<string, string | undefined> } = {}) {
  return { verificationRequired: getTurnstilePluginSettings(overrides).verificationRequired }
}

export { getCommentEditSettings }

export function validateCommentPluginManifest(plugins: readonly CommentPlugin[]): readonly CommentPlugin[] {
  const ids = new Set<string>()
  for (const plugin of plugins) {
    if (!/^[a-z][a-z0-9-]{1,62}$/.test(plugin.id)) throw new Error(`Invalid plugin ID: ${plugin.id}`)
    if (plugin.apiVersion !== 1) throw new Error(`Unsupported comment plugin API version: ${plugin.apiVersion}`)
    if (ids.has(plugin.id)) throw new Error(`Comment plugin already registered: ${plugin.id}`)
    ids.add(plugin.id)
  }
  return plugins
}

const validPluginManifest = validateCommentPluginManifest(installedCommentPlugins)

export function getCommentPlugins(): readonly CommentPlugin[] {
  return validPluginManifest
}

export async function publishCommentValidation(
  input: CommentValidationInput,
  plugins: readonly CommentPlugin[] = getCommentPlugins(),
  verificationRequired = getCommentPluginSettings().verificationRequired,
): Promise<void> {
  if (verificationRequired && !plugins.some((plugin) => plugin.verificationProvider && plugin.validateComment)) {
    throw new HttpError(503, 'COMMENT_VERIFICATION_UNAVAILABLE', 'Comment verification is temporarily unavailable', {
      expose: true,
    })
  }

  for (const plugin of plugins) {
    if (!plugin.validateComment) continue

    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        plugin.validateComment(input, controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort()
            reject(
              new HttpError(
                503,
                'COMMENT_VERIFICATION_UNAVAILABLE',
                'Comment verification is temporarily unavailable',
                { expose: true },
              ),
            )
          }, COMMENT_VALIDATION_TIMEOUT_MS)
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}

export function subscribedPlugins(
  eventType: CommentEventType,
  plugins: readonly CommentPlugin[] = getCommentPlugins(),
): readonly CommentPlugin[] {
  return plugins.filter((plugin) => plugin.events?.includes(eventType) && plugin.handleEvent)
}

export const EMPTY_SCREENING: ScreenVerdict = { decision: 'allow', reasons: [], triggeredCategories: [] }

// Runs every plugin `screenComment` hook and OR-merges the verdicts (`hide`
// wins). Screening never throws: a hook that rejects is treated as `allow`
// for that plugin so one broken screener cannot block comments.
export async function publishCommentScreening(
  input: CommentValidationInput,
  plugins: readonly CommentPlugin[] = getCommentPlugins(),
): Promise<ScreenVerdict> {
  const reasons: string[] = []
  const triggeredCategories: string[] = []
  for (const plugin of plugins) {
    if (!plugin.screenComment) continue
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const verdict = await Promise.race([
        plugin.screenComment(input, controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort()
            reject(new Error('SCREENING_TIMEOUT'))
          }, COMMENT_VALIDATION_TIMEOUT_MS)
        }),
      ])
      if (verdict.decision === 'hide') {
        for (const category of verdict.triggeredCategories) {
          if (!triggeredCategories.includes(category)) triggeredCategories.push(category)
        }
      }
      for (const reason of verdict.reasons) {
        if (reasons.length < 4) reasons.push(reason)
      }
    } catch {
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
  if (triggeredCategories.length === 0) return { decision: 'allow', reasons: reasons.slice(0, 4), triggeredCategories }
  return { decision: 'hide', reasons: reasons.slice(0, 4), triggeredCategories }
}

export async function publishCommentOperation(
  input: CommentOperationInput,
  plugins: readonly CommentPlugin[] = getCommentPlugins(),
): Promise<void> {
  for (const plugin of plugins) {
    if (!plugin.beforeOperation) continue
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        plugin.beforeOperation(input, controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort()
            reject(
              new HttpError(503, 'COMMENT_PLUGIN_UNAVAILABLE', 'Comment operations are temporarily unavailable', {
                expose: true,
              }),
            )
          }, COMMENT_VALIDATION_TIMEOUT_MS)
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}
