import {
  IMAGE_SCHEMA_DESCRIPTIONS,
  type ImageCategory,
  TEXT_SCHEMA_DESCRIPTIONS,
  type TextCategory,
} from '@/server/plugins/filter/filter-schemas'

// Versioned decider prompt for `perplexity/pplx-decider-v1.2`. Wording is a
// code knob (reviewed here); the model id and the enabled set are deployment
// knobs (`filter.config.ts`). Goldens in `tests/filter-decider-prompt.test.ts`
// pin the template shape.

export const DECIDER_PROMPT_VERSION = 'v1'

export function enabledSetHash(enabledText: readonly TextCategory[], enabledImage: readonly ImageCategory[]): string {
  return `txt:${[...enabledText].sort().join(',')}|img:${[...enabledImage].sort().join(',')}`
}

export function buildSystemPrompt(
  enabledText: readonly TextCategory[],
  enabledImage: readonly ImageCategory[],
): string {
  const textRows = enabledText.map((category) => `- ${category}: ${TEXT_SCHEMA_DESCRIPTIONS[category]}`)
  const imageRows = enabledImage.map((category) => `- ${category}: ${IMAGE_SCHEMA_DESCRIPTIONS[category]}`)
  const lines = [
    `You are a comment-moderation classifier for a blog commenting system (prompt ${DECIDER_PROMPT_VERSION}; schemas ${enabledSetHash(enabledText, enabledImage)}).`,
    'Judge the meaning of the comment text in any language. Normalise leetspeak, zero-width characters, and',
    'extra separators before scoring. Mere disagreement, profanity quoted for discussion, and code samples',
    'are not flag-worthy unless they target a person.',
    'Score ONLY the categories listed below. Never invent or return any other category.',
    'Return ONLY JSON matching the supplied schema. No prose. No markdown fences.',
  ]
  if (textRows.length > 0) lines.push('Text categories:', ...textRows)
  else lines.push('No text categories are enabled: do not flag text; judge images only.')
  if (imageRows.length > 0) lines.push('Image categories:', ...imageRows)
  else lines.push('No image categories are enabled: ignore attached images.')
  return lines.join('\n')
}

export type DeciderUserInput = {
  authorName: string
  bodyMarkdown: string
  isReply: boolean
  siteHost: string
  textJudged: boolean
  imageCount: number
}

const USER_TEXT_LIMIT = 4000

export function buildUserText(input: DeciderUserInput): string {
  const body = input.bodyMarkdown.trim().slice(0, USER_TEXT_LIMIT)
  return [
    `author: ${input.authorName.trim().slice(0, 80)}`,
    `isReply: ${input.isReply ? 'yes' : 'no'}`,
    `siteHost: ${input.siteHost}`,
    input.textJudged
      ? 'Judge the following comment text against the enabled text categories.'
      : 'Text is context only; do not flag text.',
    `body: ${body}`,
    input.imageCount > 0
      ? `Attached images: ${input.imageCount} thumbnail(s) follow as image parts; judge each against the enabled image categories.`
      : 'Attached images: none.',
  ].join('\n')
}
