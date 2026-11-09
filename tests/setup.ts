// Auth instances cache their settings on first use. Pin the test environment
// before any test module loads so the setup and normal instances always agree.
Bun.env.BETTER_AUTH_URL = 'http://localhost:3000'
Bun.env.BETTER_AUTH_SECRET = 'test-only-secret-at-least-32-characters'
Bun.env.GOOGLE_CLIENT_ID = 'test-client-id'
Bun.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
// Cloudflare's always-pass testing secret: sign-in is captcha-gated and the instance caches it too.
Bun.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA'
