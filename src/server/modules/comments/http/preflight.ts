import { assertAnySiteOrigin, requireAllowedOrigin } from '../infrastructure/comment-repository'

/**
 * Resolves the CORS origin for an OPTIONS request.
 *
 * GET and DELETE preflights carry `site` in the query string; POST, PUT and
 * PATCH carry it in the JSON body, which a preflight never sends. When the
 * query has no site, the origin is checked against every registered site so
 * the browser can learn whether the request is allowed. The real request still
 * validates the body's site, so this is not a wider grant.
 *
 * The query is read directly rather than parsed with a strict schema: a vote
 * DELETE preflight also carries `commentId`, and a strict `{ site }` schema
 * would reject it with a 400 before CORS is ever applied.
 */
export function resolvePreflightOrigin(request: Request): Promise<string | null> {
  const site = new URL(request.url).searchParams.get('site')
  const origin = request.headers.get('origin')
  return site ? requireAllowedOrigin(site, origin) : assertAnySiteOrigin(origin)
}
