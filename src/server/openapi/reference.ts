import { HttpError } from '@/server/http/errors'
import { openApiDocsEnabled } from '@/server/openapi/config'
import { buildOpenApiDocument } from '@/server/openapi/registry'

export const SCALAR_SCRIPT_URL = '/scalar/standalone.js'

const SCALAR_CDN_URL = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference'

function referenceHtml(document: unknown): string {
  // `</script>` inside the JSON would close the tag early.
  const json = JSON.stringify(document).replace(/</g, '\\u003c')
  return `<!doctype html>
<html>
  <head>
    <title>Last Comments API</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference" type="application/json">
    ${json}
    </script>
    <script>
      var configuration = {
        theme: "default",
        metaData: {
          title: "Last Comments API",
          description: "REST API reference for Last Comments",
        }
      }

      document.getElementById('api-reference').dataset.configuration =
        JSON.stringify(configuration)
    </script>
    <script src="${SCALAR_SCRIPT_URL}"></script>
  </body>
</html>`
}

export function openApiJsonResponse(request: Request, enabled: boolean = openApiDocsEnabled): Response {
  if (!enabled) throw new HttpError(404, 'OPENAPI_DISABLED', 'OpenAPI docs are disabled')
  return Response.json(buildOpenApiDocument(new URL(request.url).origin))
}

export function apiReferenceResponse(request: Request, enabled: boolean = openApiDocsEnabled): Response {
  if (!enabled) throw new HttpError(404, 'OPENAPI_DISABLED', 'OpenAPI docs are disabled')
  const document = buildOpenApiDocument(new URL(request.url).origin)
  return htmlResponse(referenceHtml(document))
}

// The dev server injects its client scripts into HTML responses after the
// body length is committed, so a buffered response arrives truncated at its
// content-length. Streaming the body keeps the response intact.
function htmlResponse(html: string): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(html))
      controller.close()
    },
  })
  return new Response(body, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}

// better-auth's open-api plugin renders its own reference page, pointing at
// the Scalar CDN. This rewrites that page to the self-hosted bundle and
// streams it, so the auth reference works without a CDN and without the
// truncation above.
export async function selfHostScalarPage(response: Response): Promise<Response> {
  if (!response.headers.get('content-type')?.includes('text/html')) return response
  const html = (await response.text()).replaceAll(SCALAR_CDN_URL, SCALAR_SCRIPT_URL)
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  return new Response(htmlResponse(html).body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
