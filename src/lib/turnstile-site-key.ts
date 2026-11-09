import { createServerFn } from '@tanstack/react-start'

// The site key is public and ships to the browser; the secret never leaves the server.
export const turnstileSiteKeyServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { getTurnstilePluginSettings } = await import('@/server/plugins/turnstile/turnstile.config')
  return { siteKey: getTurnstilePluginSettings().siteKey ?? null }
})
