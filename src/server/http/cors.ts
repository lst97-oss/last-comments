// Shared CORS echo for the public comment API. `methods` is each route's own
// verb list; `origin` is the caller's origin already validated against the
// site's allow-list (null = no CORS headers).
export function applyCors(response: Response, origin: string | null, methods: string): Response {
  if (!origin) return response
  response.headers.set('access-control-allow-origin', origin)
  response.headers.set('access-control-allow-methods', methods)
  response.headers.set('access-control-allow-headers', 'content-type')
  response.headers.set('vary', 'Origin')
  return response
}
