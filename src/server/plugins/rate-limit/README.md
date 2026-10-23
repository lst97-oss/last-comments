# Rate-limit plugin (`rate-limit`)

Per-site, per-requester operation budgets enforced in `beforeOperation`.
Identity is the signed-in user or the client IP, HMAC-hashed with
`BETTER_AUTH_SECRET` (never stored raw). The client IP is the request's socket
peer; the ingress client IP header (`CF-Connecting-IP` behind Cloudflare, else
`x-real-ip`) is used only when the peer is a trusted ingress (loopback and
private networks by default, `RATE_LIMIT_TRUSTED_PROXY_CIDR` to widen), so a
direct client cannot rotate the header to get a fresh bucket.
Windows live in the
`comment_rate_limit` schema (`migrations` pointer on the plugin); the store is
injected (`RateLimitStore`) for tests. Expired windows are pruned on every
write, retaining twice the longest configured window.
- Over budget → `429 RATE_LIMITED` with `retry-after`. Missing secret or store
  outage → `503 RATE_LIMIT_UNAVAILABLE` (fail-closed); a missing secret is
  logged once as `rate_limit.secret_missing`.

Files: `rate-limit.plugin.ts` (factory + store), `rate-limit.config.ts`
(`rateLimits` budgets + env schema + `getRateLimitPluginSettings`),
`client-ip.ts` (peer-aware client IP resolution). The secret stays in env;
budgets are reviewed here.
