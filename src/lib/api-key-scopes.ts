// Scopes the UI offers per key. Stored as the plugin's permissions map:
// { sites: [...], pages: [...] }. Instance API keys carry no metadata.site and
// manage sites; site-bound API keys bind to exactly one site and manage its threads.
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
  // Site-bound only: read threads and comments, or post and edit on behalf of
  // anonymous visitors. A key never acts as a user identity, and votes stay
  // session-only.
  'comments:read',
  'comments:write',
] as const
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]
