import { describe, expect, test } from 'bun:test'

import {
  API_KEYS_TOUR,
  type AdminTour,
  BLOG_EXAMPLE_SLUG,
  BLOG_EXAMPLE_TITLE,
  FILL_PAGE_EXAMPLE_EVENT,
  FILL_SITE_EXAMPLE_EVENT,
  MODERATION_TOUR,
  siteExample,
  SITES_TOUR,
} from '@/components/admin/admin-tours'
import { siteFormSchema } from '@/lib/site-schema'

const ROOT = `${import.meta.dir}/..`
const TOURS: AdminTour[] = [API_KEYS_TOUR, MODERATION_TOUR, SITES_TOUR]

// A step anchors on data-tour="<anchor>" in the admin UI. Matching the source keeps a renamed or
// removed anchor from silently turning a tour step into a centred popover with nothing highlighted.
async function adminSource(): Promise<string> {
  const parts: string[] = []
  for (const pattern of ['src/routes/**/*.tsx', 'src/components/admin/**/*.tsx']) {
    for await (const path of new Bun.Glob(pattern).scan({ cwd: ROOT })) {
      parts.push(await Bun.file(`${ROOT}/${path}`).text())
    }
  }
  return parts.join('\n')
}

describe('admin tours', () => {
  test('tour ids are unique', () => {
    const ids = TOURS.map((tour) => tour.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('each tour has unique anchors and non-empty copy', () => {
    for (const tour of TOURS) {
      const anchors = tour.steps.map((step) => step.anchor)
      expect(new Set(anchors).size).toBe(anchors.length)
      for (const step of tour.steps) {
        expect(step.title.trim()).not.toBe('')
        expect(step.description.trim()).not.toBe('')
      }
    }
  })

  test('every step anchor, fallback and action target exists in the admin UI', async () => {
    const source = await adminSource()
    const anchors = TOURS.flatMap((tour) => tour.steps).flatMap((step) => [
      step.anchor,
      step.fallback ?? step.anchor,
      ...(step.action && 'click' in step.action ? [step.action.click] : []),
    ])
    const missing = anchors.filter((anchor) => !source.includes(`data-tour="${anchor}"`))
    expect(missing).toEqual([])
  })

  test('the example site passes the create-site validation for any deployment origin', () => {
    for (const origin of ['https://last-comments.lst97.dev', 'http://localhost:3000']) {
      expect(siteFormSchema.safeParse(siteExample(origin)).success).toBe(true)
    }
  })

  test('tour actions click a real control or dispatch an event a view handles', async () => {
    const actions = TOURS.flatMap((tour) => tour.steps).flatMap((step) => (step.action ? [step.action] : []))
    const events = actions.flatMap((action) => ('event' in action ? [action.event] : []))
    expect([...events].sort()).toEqual([FILL_PAGE_EXAMPLE_EVENT, FILL_SITE_EXAMPLE_EVENT].sort())
    const sitesView = await Bun.file(`${ROOT}/src/components/admin/sites-view.tsx`).text()
    expect(sitesView).toContain('useWindowEvent(FILL_SITE_EXAMPLE_EVENT')
    const pageDialog = await Bun.file(`${ROOT}/src/components/admin/page-create-dialog.tsx`).text()
    expect(pageDialog).toContain('useWindowEvent(FILL_PAGE_EXAMPLE_EVENT')
    const windowEvent = await Bun.file(`${ROOT}/src/hooks/use-window-event.ts`).text()
    expect(windowEvent).toContain('window.addEventListener(type, listener)')
  })

  test('the example slug and title are the post the blog seed creates', async () => {
    const seed = await Bun.file(`${ROOT}/scripts/seeds/seed-posts.ts`).text()
    expect(seed).toContain(`slug: '${BLOG_EXAMPLE_SLUG}'`)
    expect(seed).toContain(`title: '${BLOG_EXAMPLE_TITLE}'`)
  })
})
