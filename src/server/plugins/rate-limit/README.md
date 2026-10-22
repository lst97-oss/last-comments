# Rate-limit plugin (`rate-limit`)

Per-site, per-requester operation budgets enforced in `beforeOperation`.
Identity is the signed-in user or the `x-real-ip` client IP, HMAC-hashed with
`BETTER_AUTH_SECRET` (never stored raw). Windows live in the
`comment_rate_limit` schema (`migrations` pointer on the plugin); the store is
injected (`RateLimitStore`) for tests.
- Over budget → `429 RATE_LIMITED` with `retry-after`. Missing secret or store
  outage → `503 RATE_LIMIT_UNAVAILABLE` (fail-closed); a missing secret is
  logged once as `rate_limit.secret_missing`.

Files: `rate-limit.plugin.ts` (factory + store), `rate-limit.config.ts`
(`rateLimits` budgets + env schema + `getRateLimitPluginSettings`). The secret
stays in env; budgets are reviewed here.
