import { describe, expect, test } from 'bun:test'

import { withRenderSlot } from '@/server/seo/open-graph-image'

// A render that stays in flight until released, so the test controls how many slots are held.
function hold() {
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  return { run: () => gate.then(() => 'rendered'), release }
}

describe('open graph render cap', () => {
  test('sheds renders past the concurrency cap with a 503 and a retry hint', async () => {
    const holds = Array.from({ length: 6 }, () => hold())
    const attempts = holds.map((slot) => withRenderSlot(slot.run))
    const results = await Promise.allSettled(attempts.slice(4))
    expect(results.every((result) => result.status === 'rejected')).toBe(true)
    expect(results[0]).toMatchObject({ status: 'rejected', reason: { status: 503, code: 'OG_RENDER_BUSY' } })
    for (const slot of holds.slice(0, 4)) slot.release()
    await Promise.all(attempts.slice(0, 4))
  })

  test('frees a slot once its render settles', async () => {
    const first = hold()
    const holding = Array.from({ length: 3 }, () => hold())
    const running = [withRenderSlot(first.run), ...holding.map((slot) => withRenderSlot(slot.run))]
    first.release()
    await running[0]
    await expect(withRenderSlot(() => Promise.resolve('next'))).resolves.toBe('next')
    for (const slot of holding) slot.release()
    await Promise.all(running)
  })
})
