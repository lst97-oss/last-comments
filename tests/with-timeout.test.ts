import { describe, expect, test } from 'bun:test'

import { withTimeout } from '@/server/plugins/with-timeout'

describe('withTimeout', () => {
  test('resolves with the work result when it settles in time', async () => {
    await expect(
      withTimeout(
        1_000,
        async () => 'done',
        () => new Error('late'),
      ),
    ).resolves.toBe('done')
  })

  test('rejects with the timeout error and aborts the work when it runs late', async () => {
    let signal: AbortSignal | undefined
    const pending = withTimeout(
      10,
      (received) => {
        signal = received
        return new Promise<never>(() => {})
      },
      () => new Error('late'),
    )

    await expect(pending).rejects.toThrow('late')
    expect(signal?.aborted).toBe(true)
  })

  test('passes the work error through when the work fails first', async () => {
    const pending = withTimeout(
      1_000,
      async () => {
        throw new Error('boom')
      },
      () => new Error('late'),
    )

    await expect(pending).rejects.toThrow('boom')
  })
})
