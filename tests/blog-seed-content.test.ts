import { describe, expect, test } from 'bun:test'

// Guards the seeded intro post: the renderer upgrade (Mermaid islands + Shiki
// fences) is only exercised when the seed body actually contains them.
const seedPath = `${import.meta.dir}/../scripts/seeds/introducing-last-comments.md`

describe('introducing-last-comments seed', () => {
  test('covers what-it-is, features, workflow, and goal with diagrams and code', async () => {
    const body = await Bun.file(seedPath).text()
    expect(body.length).toBeGreaterThan(2000)
    for (const heading of ['## What it is', '## Features', '## Workflow', '## Goal']) {
      expect(body).toContain(heading)
    }
    expect(body).toContain('```mermaid')
    expect(body).toContain('```tsx')
    expect(body).toContain('```bash')
    expect(body).toContain('https://shiki.style/')
  })
})
