// Scopes the UI offers per key. Stored as the plugin's permissions map:
// { sites: [...], pages: [...] }. Instance keys carry no metadata.siteKey and
// manage sites; site keys bind to exactly one site and manage its threads.
export const API_KEY_SCOPES = [
  'sites:create',
  'sites:read',
  'sites:update',
  'sites:delete',
  'pages:read',
  'pages:write',
  // Deleting a page removes its whole thread, so it is a separate grant from
  // pages:write: existing write-only keys cannot delete until they are granted it.
  'pages:delete',
] as const
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]
