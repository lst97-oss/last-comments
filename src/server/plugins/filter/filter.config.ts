import {
  ALL_IMAGE_CATEGORIES,
  ALL_TEXT_CATEGORIES,
  type FilterFileConfig,
  filterFileSchema,
  type ImageCategory,
  normalizeSchemaSet,
  type TextCategory,
} from '@/server/plugins/filter/filter-schemas'
import { definePluginConfig, secretFromEnv } from '@/server/plugins/plugin-config'

// Filter tuning (the OpenRouter key stays in the environment).

export type ResolvedFilterConfig = {
  enabled: boolean
  badwordsEnabled: boolean
  llmEnabled: boolean
  enabledText: TextCategory[]
  enabledImage: ImageCategory[]
  enabledTextSet: Set<string>
  enabledImageSet: Set<string>
  hideThreshold: number
  failOpen: boolean
  openrouter: { model: string; baseUrl: string; timeoutMs: number; maxTokens: number; apiKey: string | undefined }
  images: { maxImages: number; timeoutMs: number; maxBytes: number; longestEdge: number; quality: number }
  blocklist: string[]
  allowlist: string[]
}

function resolveApiKey(value: FilterFileConfig['openrouter']['apiKey'], env: Record<string, string | undefined>) {
  if (typeof value === 'string') return value.trim() === '' ? undefined : value
  const raw = env[value === undefined ? 'OPENROUTER_API_KEY' : value.envVar]
  return typeof raw === 'string' && raw.trim() !== '' ? raw : undefined
}

export const filterConfigDef = definePluginConfig({
  id: 'filter',
  fileSchema: filterFileSchema,
  defaults: {
    // Screening is on by default; the LLM engine needs OPENROUTER_API_KEY and
    // resolves through failOpen without it.
    enabled: true,
    engines: { badwords: true, llm: true },
    schemas: { text: 'all', image: 'all' },
    hideThreshold: 0.7,
    failOpen: true,
    openrouter: {
      model: 'perplexity/pplx-decider-v1.2',
      baseUrl: 'https://openrouter.ai/api/v1',
      timeoutMs: 8000,
      maxTokens: 400,
      apiKey: secretFromEnv('OPENROUTER_API_KEY'),
    },
    images: { maxImages: 3, timeoutMs: 4000, maxBytes: 2_000_000, longestEdge: 512, quality: 60 },
    blocklist: [],
    allowlist: [],
  } satisfies FilterFileConfig,
  resolve: (file, env): ResolvedFilterConfig => {
    const enabledText = normalizeSchemaSet(file.schemas.text, ALL_TEXT_CATEGORIES)
    const enabledImage = normalizeSchemaSet(file.schemas.image, ALL_IMAGE_CATEGORIES)
    return {
      enabled: file.enabled,
      badwordsEnabled: file.enabled && file.engines.badwords,
      llmEnabled: file.enabled && file.engines.llm,
      enabledText,
      enabledImage,
      enabledTextSet: new Set(enabledText),
      enabledImageSet: new Set(enabledImage),
      hideThreshold: file.hideThreshold,
      failOpen: file.failOpen,
      openrouter: {
        model: file.openrouter.model,
        baseUrl: file.openrouter.baseUrl.replace(/\/$/, ''),
        timeoutMs: file.openrouter.timeoutMs,
        maxTokens: file.openrouter.maxTokens,
        apiKey: resolveApiKey(file.openrouter.apiKey, env),
      },
      images: { ...file.images },
      blocklist: [...file.blocklist],
      allowlist: [...file.allowlist],
    }
  },
})

export const filterConfig: FilterFileConfig = filterConfigDef.defaults
