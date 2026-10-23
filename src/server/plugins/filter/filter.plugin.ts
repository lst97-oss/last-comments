import { getRequestLogger, type Logger } from '@/server/observability/logger'
import type { CommentPlugin, CommentValidationInput, ScreenVerdict } from '@/server/plugins/comment-plugins'
import { type BadwordsFilter, screenBadwords } from '@/server/plugins/filter/badwords-screen'
import { buildQuestions, buildStateText } from '@/server/plugins/filter/decider-prompt'
import { filterConfig, filterConfigDef, type ResolvedFilterConfig } from '@/server/plugins/filter/filter.config'
import { extractImageUrls, fetchAndShrink } from '@/server/plugins/filter/image-prep'
import { callDecider, DeciderError, type DeciderSender } from '@/server/plugins/filter/openrouter-client'
import { loadPluginConfig } from '@/server/plugins/plugin-config'

// Filter plugin: lexical (`bad-words`) + LLM (`pplx-decider-v1.2` via the
// OpenRouter Decisions API) screening that marks hits `hidden` for review. It
// never throws — transport failures resolve through `failOpen` (allow + warn,
// or hide + warn), so commenters never see a 5xx from this plugin.

export function getFilterSettings(env?: Record<string, string | undefined>): ResolvedFilterConfig {
  return loadPluginConfig(filterConfigDef, { file: filterConfig, env })
}

function siteHostOf(pageUrl: string): string {
  try {
    return new URL(pageUrl).hostname.toLowerCase()
  } catch {
    return 'unknown'
  }
}

function truncateForLog(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > 120 ? `${flat.slice(0, 120)}…` : flat
}

async function loadBadwordsFilter(logger: Logger): Promise<BadwordsFilter | null> {
  try {
    // Dynamic import: a missing install degrades to LLM-only screening
    // instead of crashing the plugin host at module load.
    const { Filter } = await import('bad-words')
    return new Filter()
  } catch (cause) {
    logger.warn('filter.badwords_unavailable', { reason: cause instanceof Error ? cause.message : String(cause) })
    return null
  }
}

export function applyVerdictThreshold(
  verdict: {
    textSignals: { category: string; confidence: number }[]
    imageSignals: { category: string; confidence: number }[]
  },
  options: { enabledText: Set<string>; enabledImage: Set<string>; hideThreshold: number },
): string[] {
  const triggered = new Set<string>()
  const consider = (category: string, confidence: number, enabled: Set<string>) => {
    // Defence in depth: questions only exist for enabled categories, but a
    // drifted response must never hide through a disabled one. `benign` is
    // evidence only — it never triggers a hide.
    if (!enabled.has(category) || category === 'benign') return
    if (confidence >= options.hideThreshold) triggered.add(category)
  }
  for (const signal of verdict.textSignals) consider(signal.category, signal.confidence, options.enabledText)
  for (const signal of verdict.imageSignals) consider(signal.category, signal.confidence, options.enabledImage)
  return [...triggered]
}

export function createFilterPlugin(
  deps: {
    loadConfig?: () => ResolvedFilterConfig
    createWordFilter?: () => Promise<BadwordsFilter | null>
    deciderSender?: DeciderSender
    logger?: Logger
  } = {},
): CommentPlugin {
  const loadConfig = deps.loadConfig ?? getFilterSettings
  const pluginLogger = (deps.logger ?? getRequestLogger()).child({ plugin: 'filter' })
  const createWordFilter = deps.createWordFilter ?? (() => loadBadwordsFilter(pluginLogger))

  return {
    id: 'filter',
    apiVersion: 1,
    async screenComment(input: CommentValidationInput, signal: AbortSignal): Promise<ScreenVerdict> {
      const startedAt = Date.now()
      const config = loadConfig()
      if (!config.enabled || (!config.badwordsEnabled && !config.llmEnabled))
        return {
          decision: 'allow',
          reasons: [],
          triggeredCategories: [],
          detail: { engines: [], enabledText: [...config.enabledText], enabledImage: [...config.enabledImage] },
        }

      const reasons: string[] = []
      const triggeredCategories: string[] = []
      const engines: string[] = []
      const text = `${input.authorName}\n${input.bodyMarkdown}`

      if (config.badwordsEnabled && !signal.aborted) {
        engines.push('badwords')
        const wordFilter = await createWordFilter()
        if (wordFilter) {
          const hit = screenBadwords(text, {
            blocklist: config.blocklist,
            allowlist: config.allowlist,
            filter: wordFilter,
          })
          if (hit.flagged) {
            triggeredCategories.push('lexical')
            reasons.push(`Blocked term matched (${hit.matchedTerms.slice(0, 3).join(', ')})`)
          }
        } else if (!config.llmEnabled) {
          pluginLogger.warn('filter.engine_unavailable', { engine: 'badwords' })
        }
      }

      if (config.llmEnabled && !signal.aborted) {
        engines.push('llm')
        const verdict = await screenWithDecider(input, config, {
          deciderSender: deps.deciderSender,
          logger: pluginLogger,
          signal,
        })
        for (const category of verdict.triggered) {
          if (!triggeredCategories.includes(category)) triggeredCategories.push(category)
        }
        for (const reason of verdict.reasons) {
          if (reasons.length < 4) reasons.push(reason)
        }
      }

      const decision = triggeredCategories.length > 0 ? 'hide' : 'allow'
      pluginLogger.info('filter.decision', {
        decision,
        engines: engines.join(','),
        enabledText: config.enabledText.join(','),
        enabledImage: config.enabledImage.join(','),
        categories: triggeredCategories.join(','),
        latencyMs: Date.now() - startedAt,
        bodyPreview: truncateForLog(input.bodyMarkdown),
      })
      return {
        decision,
        reasons: reasons.slice(0, 4),
        triggeredCategories,
        detail: { engines, enabledText: [...config.enabledText], enabledImage: [...config.enabledImage] },
      }
    },
  }
}

async function screenWithDecider(
  input: CommentValidationInput,
  config: ResolvedFilterConfig,
  deps: { deciderSender?: DeciderSender; logger: Logger; signal: AbortSignal },
): Promise<{ triggered: string[]; reasons: string[] }> {
  const { logger } = deps
  if (config.enabledText.length === 0 && config.enabledImage.length === 0) {
    logger.warn('filter.llm_skipped', { reason: 'no_schemas' })
    return { triggered: [], reasons: [] }
  }
  if (!config.openrouter.apiKey) {
    logger.warn('filter.llm_skipped', { reason: 'missing_key' })
    return unavailable(config, 'OPENROUTER_API_KEY is not configured')
  }

  const imageDataUrls: string[] = []
  if (config.enabledImage.length > 0 && config.images.maxImages > 0 && !deps.signal.aborted) {
    const urls = extractImageUrls(input.bodyMarkdown, config.images.maxImages)
    const prepared = await Promise.all(urls.map((url) => fetchAndShrink(url, config.images)))
    const kept = prepared.filter((image) => image !== null)
    for (const image of kept) {
      if (imageDataUrls.length >= config.images.maxImages) break
      imageDataUrls.push(image.dataUrl)
    }
    if (kept.length < urls.length) {
      logger.warn('filter.image_skipped', { reason: 'fetch_or_shrink_failed', attempted: urls.length })
    }
  }

  const state = buildStateText({
    authorName: input.authorName,
    bodyMarkdown: input.bodyMarkdown,
    isReply: input.parentId !== undefined && input.parentId !== null && input.parentId !== '',
    siteHost: siteHostOf(input.pageUrl),
    textJudged: config.enabledText.length > 0,
    imageCount: imageDataUrls.length,
  })
  const questions = buildQuestions(config.enabledText, config.enabledImage, imageDataUrls.length)
  if (Object.keys(questions).length === 0) {
    logger.warn('filter.llm_skipped', { reason: 'no_questions' })
    return { triggered: [], reasons: [] }
  }

  try {
    const verdict = await callDecider(
      { state, questions, imageDataUrls },
      config.openrouter,
      deps.deciderSender ? { sender: deps.deciderSender } : {},
    )
    const triggered = applyVerdictThreshold(verdict, {
      enabledText: config.enabledTextSet,
      enabledImage: config.enabledImageSet,
      hideThreshold: config.hideThreshold,
    })
    const signals = [...verdict.textSignals, ...verdict.imageSignals]
    const reasons = triggered.map((category) => {
      const confidence = Math.max(
        ...signals.filter((signal) => signal.category === category).map((signal) => signal.confidence),
      )
      return `auto.hide: ${category}(${confidence.toFixed(2)})`
    })
    return { triggered, reasons: reasons.slice(0, 4) }
  } catch (cause) {
    const reason = cause instanceof DeciderError ? cause.reason : 'unknown'
    logger.warn('filter.llm_error', { reason })
    return unavailable(config, `Decider ${reason}`)
  }
}

function unavailable(config: ResolvedFilterConfig, message: string): { triggered: string[]; reasons: string[] } {
  // Fail-open (default): advisory filter must not block comments on outages.
  // Fail-closed: hold for review instead — still never a 5xx to the writer.
  if (config.failOpen) return { triggered: [], reasons: [] }
  return { triggered: ['unavailable'], reasons: [`${message}; held for review`] }
}

export const filterPlugin = createFilterPlugin()
