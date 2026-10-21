import { describe, expect, test } from 'bun:test'

import { createComment } from '@/server/modules/comments/application/create-comment'

const input = {
  siteKey: 'docs',
  pageUrl: 'https://example.com/post',
  userId: null,
  authorName: 'Guest',
  bodyMarkdown: 'hello',
}

describe('create comment use case', () => {
  test('validates the prepared comment before persisting it', async () => {
    const calls: string[] = []
    const comment = { id: 'comment-1' }

    const result = await createComment(input, {
      prepare: async () => ({ siteId: 'site-1', pageUrl: 'https://example.com/post' }),
      validate: async (validationInput) => {
        calls.push('validate')
        expect(validationInput.siteId).toBe('site-1')
        expect(validationInput.pageUrl).toBe('https://example.com/post')
      },
      persist: async () => {
        calls.push('persist')
        return comment
      },
    })

    expect(result).toBe(comment)
    expect(calls).toEqual(['validate', 'persist'])
  })

  test('does not persist when a validator rejects the comment', async () => {
    let persisted = false

    await expect(
      createComment(input, {
        prepare: async () => ({ siteId: 'site-1', pageUrl: 'https://example.com/post' }),
        validate: async () => {
          throw new Error('verification failed')
        },
        persist: async () => {
          persisted = true
        },
      }),
    ).rejects.toThrow('verification failed')

    expect(persisted).toBe(false)
  })
})
