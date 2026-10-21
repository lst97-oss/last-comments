import { describe, expect, test } from 'bun:test'

import { Route as ApiAuthSplatRoute } from '@/routes/api.auth.$'
import { Route as ApiOpenapiJsonRoute } from '@/routes/api.openapi[.]json'
import { Route as ApiReferenceRoute } from '@/routes/api.reference'
import { HttpError } from '@/server/http/errors'
import { apiReferenceResponse, openApiJsonResponse } from '@/server/openapi/reference'
import { handlerOf } from './helpers/integration'

const SPEC_PATHS = [
  '/api/comments',
  '/api/comments/{commentId}',
  '/api/comments/vote',
  '/api/moderation',
  '/api/admin/sites',
  '/api/admin/sites/{siteKey}',
  '/api/admin/pages',
  '/api/admin/pages/{pageId}',
  '/api/admin/users',
  '/api/admin/users/{userId}/comments',
  '/api/admin/settings',
  '/api/admin/stats',
  '/api/admin/api-keys',
  '/api/session',
  '/api/auth-providers',
  '/api/initial-admin',
  '/api/live',
  '/api/ready',
]

describe('open api plugin', () => {
  test('serves the business document with every documented path', async () => {
    const response = await handlerOf(ApiOpenapiJsonRoute, 'GET')(new Request('https://example.com/api/openapi.json'))
    expect(response.status).toBe(200)

    const document = (await response.json()) as {
      openapi: string
      info: { title: string }
      servers: { url: string }[]
      paths: Record<string, unknown>
      components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown> }
    }
    expect(document.openapi).toStartWith('3.1.')
    expect(document.info.title).toBe('Last Comments API')
    expect(document.servers[0]?.url).toBe('https://example.com')
    expect(Object.keys(document.paths).sort()).toEqual([...SPEC_PATHS].sort())
    expect(document.components.schemas.Comment).toBeDefined()
    expect(document.components.schemas.ApiError).toBeDefined()
    // The Recent tab reads per-thread window activity off the pages list.
    const summary = document.components.schemas.ModerationPageSummary as {
      properties: Record<string, unknown>
    }
    expect(Object.keys(summary.properties).sort()).toContain('recent')
    // The Users tab and Settings page read their own shapes.
    expect(document.components.schemas.SiteUser).toBeDefined()
    expect(document.components.schemas.UserCommentHistoryItem).toBeDefined()
    expect(document.components.schemas.InstanceSettings).toBeDefined()
    expect(Object.keys(document.components.securitySchemes).sort()).toEqual(['serviceKey', 'sessionCookie'])
  })

  test('documents the schemas the routes actually validate against', async () => {
    const document = (await openApiJsonResponse(new Request('https://example.com/api/openapi.json')).json()) as {
      paths: Record<
        string,
        { patch?: { requestBody: { content: Record<string, { schema: { required?: string[] } }> } } }
      >
    }
    const body = document.paths['/api/comments/{commentId}']?.patch?.requestBody.content['application/json']?.schema
    expect(body?.required).toEqual(['site', 'bodyMarkdown'])
  })

  test('answers 404 when the plugin is uninstalled', () => {
    const request = new Request('https://example.com/api/openapi.json')
    expect(() => openApiJsonResponse(request, false)).toThrow(HttpError)
    expect(() => apiReferenceResponse(request, false)).toThrow(HttpError)
    try {
      openApiJsonResponse(request, false)
    } catch (error) {
      expect((error as HttpError).status).toBe(404)
      expect((error as HttpError).code).toBe('OPENAPI_DISABLED')
    }
  })

  test('serves the Scalar reference page', async () => {
    const response = await handlerOf(ApiReferenceRoute, 'GET')(new Request('https://example.com/api/reference'))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')

    const html = await response.text()
    // The Scalar bundle is self-hosted, so the page must not reach for a CDN.
    expect(html).toContain('/scalar/standalone.js')
    expect(html).not.toContain('cdn.jsdelivr.net')
    expect(html).toContain('"openapi"')
  })

  test('serves the auth reference through the better-auth plugin', async () => {
    const response = await handlerOf(ApiAuthSplatRoute, 'GET')(new Request('https://example.com/api/auth/reference'))
    expect(response.status).toBe(200)

    const html = await response.text()
    expect(html).toContain('Scalar API Reference')
    // better-auth renders the page with the Scalar CDN script; the response
    // is rewritten to the self-hosted bundle.
    expect(html).toContain('/scalar/standalone.js')
    expect(html).not.toContain('cdn.jsdelivr.net')
  })

  test('hides the whole /api/auth mount — reference included — without better-auth', async () => {
    const previous = Bun.env.AUTH_PROVIDERS
    Bun.env.AUTH_PROVIDERS = 'oidc-jwt'
    try {
      const reference = await handlerOf(ApiAuthSplatRoute, 'GET')(new Request('https://example.com/api/auth/reference'))
      expect(reference.status).toBe(404)
      await expect(reference.json()).resolves.toMatchObject({ error: { code: 'AUTH_PROVIDER_DISABLED' } })

      const session = await handlerOf(
        ApiAuthSplatRoute,
        'POST',
      )(
        new Request('https://example.com/api/auth/sign-in/email', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        }),
      )
      expect(session.status).toBe(404)
    } finally {
      if (previous === undefined) delete Bun.env.AUTH_PROVIDERS
      else Bun.env.AUTH_PROVIDERS = previous
    }
  })
})
