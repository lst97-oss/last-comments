import { notFound, redirect } from '@tanstack/react-router'
import type { ReactNode } from 'react'

export type AdminRenderResult = {
  intent: { type?: 'notFound' | 'redirect'; url?: string } | null
  element: ReactNode
}

export type AdminRenderIntent = { type: 'render' } | { type: 'not-found' } | { type: 'redirect'; url: string }

export type AdminRenderRequest = {
  search: Record<string, string | string[]>
  segments: string[]
}

export function buildAdminRenderRequest(searchStr: string, segments: string[]): AdminRenderRequest {
  return { search: parseAdminSearchParams(searchStr), segments }
}

export function buildAdminRenderParams(segments: string[]): { segments?: string[] } {
  return segments.length === 0 ? {} : { segments }
}

export function parseAdminSearchParams(searchStr: string): Record<string, string | string[]> {
  const search: Record<string, string | string[]> = {}
  for (const [key, value] of new URLSearchParams(searchStr).entries()) {
    search[key] = value
  }
  return search
}

export function getAdminRenderIntent(intent: AdminRenderResult['intent']): AdminRenderIntent {
  if (intent?.type === 'notFound') return { type: 'not-found' }
  if (intent?.type === 'redirect' && intent.url) {
    return { type: 'redirect', url: intent.url }
  }
  return { type: 'render' }
}

export function resolveAdminRenderResult(result: AdminRenderResult): AdminRenderResult {
  const intent = getAdminRenderIntent(result.intent)
  if (intent.type === 'redirect') {
    throw redirect({ to: intent.url })
  }
  if (intent.type === 'not-found') {
    throw notFound({ data: { element: result.element } })
  }
  return result
}
