/**
 * Social share card wiring.
 *
 * The card is rendered per page by `/og` from the committed pixel-art
 * artwork, so every page carries its own title and description instead of
 * pointing at one static image.
 */

/** Design space of the card; the artwork is authored at this size. */
export const OG_IMAGE_WIDTH = 1672
export const OG_IMAGE_HEIGHT = 941

/** Widget ports listed in the card footer. */
export const OG_FRAMEWORKS = ['React', 'Vue', 'Angular', 'HTML']

export const OG_IMAGE_ROUTE = '/og'

/** Path and query string of the card for one page. */
export function ogImageQuery(title: string, description: string): string {
  const params = new URLSearchParams({ title, description })
  return `${OG_IMAGE_ROUTE}?${params.toString()}`
}

/**
 * Absolute URL of the card. An empty `baseUrl` (local dev) keeps the path
 * relative — the same fallback the other SEO tags use.
 */
export function ogImageUrl(baseUrl: string, title: string, description: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  const query = ogImageQuery(title, description)
  return base ? `${base}${query}` : query
}

export function ogImageAlt(title: string): string {
  return `Last Comments share card for ${title}`
}
