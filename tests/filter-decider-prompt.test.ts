import { describe, expect, test } from 'bun:test'

import { buildSystemPrompt, buildUserText, DECIDER_PROMPT_VERSION } from '@/server/plugins/filter/decider-prompt'

describe('decider prompt', () => {
  test('carries the prompt version and only enabled definitions', () => {
    const prompt = buildSystemPrompt(['spam_scam'], ['sexual_explicit'])
    expect(prompt).toContain(DECIDER_PROMPT_VERSION)
    expect(prompt).toContain('spam_scam')
    expect(prompt).toContain('sexual_explicit')
    expect(prompt).not.toContain('harassment_hate')
    expect(prompt).not.toContain('graphic_violence_gore')
    expect(prompt).toMatch(/Return ONLY JSON/)
  })

  test('distinct enabled sets produce distinct headers', () => {
    const a = buildSystemPrompt(['spam_scam'], [])
    const b = buildSystemPrompt(['harassment_hate'], [])
    expect(a).not.toBe(b)
    expect(buildSystemPrompt(['spam_scam'], [])).toBe(a)
  })

  test('empty text set instructs text-context-only mode', () => {
    const prompt = buildSystemPrompt([], ['sexual_explicit'])
    expect(prompt).toMatch(/do not flag text/i)
    const user = buildUserText({
      authorName: 'Ada',
      bodyMarkdown: 'hello',
      isReply: false,
      siteHost: 'example.com',
      textJudged: false,
      imageCount: 1,
    })
    expect(user).toMatch(/do not flag text/i)
    expect(user).toContain('example.com')
    expect(user).not.toContain('https://example.com/post')
  })

  test('user text marks replies and truncates long bodies', () => {
    const user = buildUserText({
      authorName: 'Ada',
      bodyMarkdown: `x`.repeat(9000),
      isReply: true,
      siteHost: 'example.com',
      textJudged: true,
      imageCount: 0,
    })
    expect(user).toContain('isReply: yes')
    expect(user).toContain('Attached images: none.')
    expect(user.length).toBeLessThan(6000)
  })
})
