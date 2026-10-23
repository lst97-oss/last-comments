# Turnstile plugin (`turnstile`)

Cloudflare Turnstile verification. Implements `verificationProvider` +
`validateComment`: with `verificationRequired` on (the default in
`turnstile.config.ts`), every post must present a token that verifies against
`siteverify` for the thread's hostname — guests and signed-in authors alike.
- Fails closed: missing `TURNSTILE_SECRET_KEY` or unreachable Siteverify →
  `503 COMMENT_VERIFICATION_UNAVAILABLE`; bad token or hostname mismatch →
  `403 COMMENT_VERIFICATION_FAILED`.
- `verificationRequired: false` is the local-development bypass (guests post
  without a token).

Keys:
- `TURNSTILE_SECRET_KEY` (env) — the secret. `TURNSTILE_SITE_KEY` (env) is the
  public site key; the file config's `siteKey` wins over it, so a host that
  edits `turnstile.config.ts` never depends on the environment.
- Cloudflare's testing keys work on any domain, including localhost: site key
  `1x00000000000000000000AA` (always passes), secret
  `1x0000000000000000000000000000000AA` (always passes). The plugin skips the
  hostname check for those secrets, because Siteverify always answers them with
  the hostname `example.com`.

Files: `turnstile.plugin.ts` (factory + instance), `turnstile.config.ts`
(file schema + `getTurnstilePluginSettings`). Secrets stay in env.
