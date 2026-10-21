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
] as const
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]
