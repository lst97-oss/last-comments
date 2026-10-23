// Shared CORS echo for the public comment API and the auth API. `methods` is
// each route's own verb list; `origin` is the caller's origin already validated
// against the site's allow-list (null = no CORS headers).
//
// Credentials are allowed because widgets send their session cookie
// (`credentials: 'include'`). That is only safe with an exact echoed origin,
// never `*`, so the origin must already be validated by the caller.
export function applyCors(response: Response, origin: string | null, methods: string): Response {
  if (!origin) return response
  response.headers.set('access-control-allow-origin', origin)
  response.headers.set('access-control-allow-credentials', 'true')
  response.headers.set('access-control-allow-methods', methods)
  response.headers.set('access-control-allow-headers', 'content-type')
  response.headers.set('vary', 'Origin')
  return response
}
