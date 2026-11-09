import { describe, expect, test } from 'bun:test'

import { excerpt, formatNotification } from '@/server/plugins/notifications/notifications.format'

describe('notification copy', () => {
  test('excerpt strips markdown and cuts long text', () => {
    expect(excerpt('Nice **post**, see [the docs](https://x.test)!')).toBe('Nice post, see the docs!')
    expect(excerpt('a'.repeat(300)).length).toBe(140)
    expect(excerpt('a'.repeat(300)).endsWith('…')).toBe(true)
  })

  test('a deleted or hidden notice carries no comment text', () => {
    const deleted = formatNotification({
      kind: 'deleted',
      pageId: 'p',
      pageUrl: '/post',
      siteKey: 'site-a',
      siteId: 's',
      bodyMarkdown: 'secret words',
    })
    expect(deleted.body).toBe('')
    expect(JSON.stringify(deleted)).not.toContain('secret words')
  })

  test('held notices are high priority and list the reasons', () => {
    const held = formatNotification({
      kind: 'held',
      pageId: 'p',
      pageUrl: '/post',
      siteKey: 'site-a',
      siteId: 's',
      authorName: 'Guest',
      bodyMarkdown: 'hi',
      reasons: ['spam'],
    })
    expect(held.priority).toBe(1)
    expect(held.title).toContain('spam')
  })

  test('every notice links to the moderation page for its page', () => {
    expect(
      formatNotification({
        kind: 'created',
        siteKey: 'site-a',
        pageId: 'page-9',
        pageUrl: '/p',
        siteId: 's',
      }).data,
    ).toMatchObject({
      url: '/moderation/page-9?site=site-a',
    })
  })
})
