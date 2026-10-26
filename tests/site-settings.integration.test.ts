import { afterAll, describe, expect, test } from 'bun:test'

import { Route as SettingsRoute } from '@/routes/api.comments.settings'
import { createAdminSite, updateAdminSite } from '@/server/modules/admin/infrastructure/admin-repository'
import { cleanupTestData, handlerOf, siteKeys } from './helpers/integration'

afterAll(cleanupTestData)

const getSettings = handlerOf(SettingsRoute, 'GET')
const origin = 'https://settings.example.test'

async function createSite(name: string) {
  const site = await createAdminSite(null, { name, origin })
  siteKeys.push(site.key)
  return site
}

function settingsRequest(siteKey: string, headers: Record<string, string> = {}) {
  return new Request(`http://localhost:3000/api/comments/settings?site=${encodeURIComponent(siteKey)}`, { headers })
}

describe('public site settings', () => {
  test('a new site reports the open defaults, with the ceiling as its limit', async () => {
    const site = await createSite('Settings defaults')
    const response = await getSettings(settingsRequest(site.key))
    expect(response.status).toBe(200)
    const body = (await response.json()) as { data: { settings: Record<string, unknown> } }
    expect(body.data.settings).toMatchObject({
      version: 1,
      access: 'open',
      bodyLimit: 10_000,
      anonEditWindowMinutes: expect.any(Number),
    })
    expect(body.data.settings).toHaveProperty('turnstileSiteKey')
  })

  test('a dashboard change to access and length is reflected on the next read', async () => {
    const site = await createSite('Settings changed')
    await updateAdminSite(site.key, { access: 'login', bodyLimit: 500 })
    const body = (await (await getSettings(settingsRequest(site.key))).json()) as {
      data: { settings: { access: string; bodyLimit: number } }
    }
    expect(body.data.settings.access).toBe('login')
    expect(body.data.settings.bodyLimit).toBe(500)
  })

  test('the vote switch is published as a feature flag and follows the dashboard', async () => {
    const site = await createSite('Settings votes')
    const features = async () =>
      ((await (await getSettings(settingsRequest(site.key))).json()) as { data: { settings: { features: unknown } } })
        .data.settings.features
    expect(await features()).toEqual({ votes: true })
    await updateAdminSite(site.key, { votesEnabled: false })
    expect(await features()).toEqual({ votes: false })
  })

  test('a successful read is cacheable for a minute and readable from any origin, without credentials', async () => {
    const site = await createSite('Settings headers')
    const response = await getSettings(settingsRequest(site.key, { origin: 'https://elsewhere.example' }))
    expect(response.headers.get('cache-control')).toBe('public, max-age=60, stale-while-revalidate=300')
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('access-control-allow-credentials')).toBeNull()
  })

  test('an unknown site is a 404 that a widget can still read across origins', async () => {
    const response = await getSettings(settingsRequest('no-such-site-key'))
    expect(response.status).toBe(404)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(await response.json()).toMatchObject({ error: { code: 'SITE_NOT_FOUND' } })
  })

  test('a gateway-only site still publishes its settings, since the document holds no key', async () => {
    const site = await createSite('Settings gateway')
    await updateAdminSite(site.key, { gatewayOnly: true })
    const response = await getSettings(settingsRequest(site.key))
    expect(response.status).toBe(200)
  })

  test('the document carries no secret or per-viewer field', async () => {
    const site = await createSite('Settings secrets')
    const text = await (await getSettings(settingsRequest(site.key))).text()
    expect(text).not.toMatch(/lck_|secret|apikey|session|gatewayOnly|userId/i)
  })
})
