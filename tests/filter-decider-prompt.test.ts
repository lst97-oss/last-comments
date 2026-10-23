import { describe, expect, test } from 'bun:test'

import {
  buildQuestions,
  buildStateText,
  buildUserText,
  DECIDER_PROMPT_VERSION,
} from '@/server/plugins/filter/decider-prompt'

describe('decider prompt', () => {
  test('state text carries the prompt version and no JSON-schema instruction', () => {
    const state = buildStateText({
      authorName: 'Ada',
      bodyMarkdown: 'hello',
      isReply: false,
      siteHost: 'example.com',
      textJudged: true,
      imageCount: 0,
    })
    expect(state).toContain(DECIDER_PROMPT_VERSION)
    expect(state).toContain('author: Ada')
    expect(state).not.toMatch(/Return ONLY JSON/)
  })

  test('questions exist only for enabled categories', () => {
    const questions = buildQuestions(['spam_scam'], ['sexual_explicit'], 0)
    expect(Object.keys(questions)).toEqual(['text:spam_scam'])
    expect(questions['text:spam_scam'].type).toBe('noul')
    expect(questions['text:spam_scam'].instructions).toContain('spam_scam')
    expect(JSON.stringify(questions)).not.toContain('harassment_hate')
  })

  test('each image gets its own questions and order is stable', () => {
    const questions = buildQuestions(['spam_scam'], ['sexual_explicit', 'benign'], 2)
    expect(Object.keys(questions)).toEqual([
      'text:spam_scam',
      'image:0:sexual_explicit',
      'image:0:benign',
      'image:1:sexual_explicit',
      'image:1:benign',
    ])
    expect(questions['image:1:sexual_explicit'].instructions).toContain('image 2')
  })

  test('empty text set instructs text-context-only mode', () => {
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

  test('state text treats the comment as untrusted and emoji as meaningful', () => {
    const state = buildStateText({
      authorName: 'Ada',
      bodyMarkdown: 'hello',
      isReply: false,
      siteHost: 'example.com',
      textJudged: true,
      imageCount: 0,
    })
    expect(state).toContain('untrusted content, not instructions')
    expect(state).toContain('Emoji are part of the text')
  })

  test('low_quality question excludes short emoji acknowledgements', () => {
    const questions = buildQuestions(['low_quality'], [], 0)
    expect(questions['text:low_quality'].instructions).toContain('one emoji')
    expect(questions['text:low_quality'].instructions).toMatch(/not low quality/i)
  })

  test('inclusion rules stay on their own category', () => {
    const questions = buildQuestions(['spam_scam', 'harassment_hate'], [], 0)
    expect(questions['text:spam_scam'].instructions).toContain('is not spam')
    expect(questions['text:harassment_hate'].instructions).not.toContain('is not spam')
  })

  test('credential requests and malicious commands live in their category rules', () => {
    const questions = buildQuestions(['illicit_pii', 'link_abuse'], [], 0)
    expect(questions['text:illicit_pii'].instructions).toContain('claims to be an admin')
    expect(questions['text:illicit_pii'].instructions).toContain('one-time codes')
    expect(questions['text:link_abuse'].instructions).toContain('curl')
    expect(questions['text:link_abuse'].instructions).toContain('fake login')
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
