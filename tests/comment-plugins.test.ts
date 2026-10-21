import { describe, expect, test } from 'bun:test'

import {
  getCommentEditSettings,
  getCommentPluginSettings,
  publishCommentOperation,
  publishCommentValidation,
  subscribedPlugins,
  type CommentPlugin,
} from '@/server/plugins/comment-plugins'

const submission = {
  siteId: 'site-1',
  pageUrl: 'https://example.com/',
  bodyMarkdown: 'hello',
  userId: null,
  authorName: 'Guest',
}

describe('comment plugin contract', () => {
  test('reads the verification switch from the turnstile file config', () => {
    expect(getCommentPluginSettings()).toEqual({ verificationRequired: true })
    expect(getCommentPluginSettings({ file: { verificationRequired: false } })).toEqual({ verificationRequired: false })
  })

  test('reads the guest edit window from the comment policy file', () => {
    expect(getCommentEditSettings()).toEqual({ anonWindowMinutes: 10 })
    expect(getCommentEditSettings({ anonEditWindowMinutes: 30 })).toEqual({ anonWindowMinutes: 30 })
    expect(getCommentEditSettings({ anonEditWindowMinutes: 0 })).toEqual({ anonWindowMinutes: 0 })
    expect(() => getCommentEditSettings({ anonEditWindowMinutes: -1 })).toThrow()
  })

  test('validates the static plugin manifest and rejects duplicate IDs', async () => {
    const pluginModule = (await import(
      '@/server/plugins/comment-plugins'
    )) as typeof import('@/server/plugins/comment-plugins') & {
      validateCommentPluginManifest?: (plugins: readonly CommentPlugin[]) => readonly CommentPlugin[]
    }
    expect(typeof pluginModule.validateCommentPluginManifest).toBe('function')
    if (!pluginModule.validateCommentPluginManifest) return

    const plugin: CommentPlugin = { id: 'example-plugin', apiVersion: 1 }
    expect(pluginModule.validateCommentPluginManifest([plugin])).toEqual([plugin])
    expect(() => pluginModule.validateCommentPluginManifest([plugin, plugin])).toThrow(
      'Comment plugin already registered: example-plugin',
    )
    expect(() => pluginModule.validateCommentPluginManifest([{ ...plugin, apiVersion: 2 as 1 }])).toThrow(
      'Unsupported comment plugin API version: 2',
    )
  })

  test('runs registered validation hooks before persistence', async () => {
    const calls: string[] = []
    const plugins: CommentPlugin[] = [
      {
        id: 'verify',
        apiVersion: 1,
        validateComment: async () => {
          calls.push('verify')
        },
      },
      {
        id: 'filter',
        apiVersion: 1,
        validateComment: async () => {
          calls.push('filter')
        },
      },
    ]

    // The flag is explicit on purpose: ambient config requires verification,
    // which would fail closed before the hooks under test ever run.
    await publishCommentValidation(submission, plugins, false)

    expect(calls).toEqual(['verify', 'filter'])
  })

  test('fails closed when an enabled validator fails', async () => {
    const plugins: CommentPlugin[] = [
      {
        id: 'turnstile',
        apiVersion: 1,
        validateComment: async () => {
          throw new Error('verification failed')
        },
      },
    ]

    await expect(publishCommentValidation(submission, plugins, false)).rejects.toThrow('verification failed')
  })

  test('fails closed for guest comments when required verification is unavailable', async () => {
    await expect(publishCommentValidation(submission, [], true)).rejects.toMatchObject({
      code: 'COMMENT_VERIFICATION_UNAVAILABLE',
    })
  })

  test('aborts a verification plugin that exceeds its timeout', async () => {
    let signal: AbortSignal | undefined
    const pending = publishCommentValidation(
      submission,
      [
        {
          id: 'slow-verifier',
          apiVersion: 1,
          validateComment: async (_input, receivedSignal) => {
            signal = receivedSignal
            await new Promise<void>(() => {})
          },
        },
      ],
      false,
    )

    await expect(pending).rejects.toMatchObject({ code: 'COMMENT_VERIFICATION_UNAVAILABLE' })
    expect(signal?.aborted).toBe(true)
  }, 7_000)

  test('selects event subscribers without exposing unregistered plugin IDs', () => {
    const plugins: CommentPlugin[] = [
      { id: 'discord', apiVersion: 1, events: ['comment.created'], handleEvent: async () => {} },
      { id: 'audit', apiVersion: 1, events: ['comment.deleted'], handleEvent: async () => {} },
    ]

    expect(subscribedPlugins('comment.created', plugins).map((plugin) => plugin.id)).toEqual(['discord'])
  })

  test('runs operation hooks with the operation and requester context', async () => {
    let received: unknown
    const request = new Request('https://comments.example/api/comments', { method: 'POST' })
    await publishCommentOperation({ operation: 'comment.create', siteKey: 'docs', userId: 'user-1', request }, [
      {
        id: 'rate-limit',
        apiVersion: 1,
        beforeOperation: async (input) => {
          received = input
        },
      },
    ])
    expect(received).toEqual({ operation: 'comment.create', siteKey: 'docs', userId: 'user-1', request })
  })
})
