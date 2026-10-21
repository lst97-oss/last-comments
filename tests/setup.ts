// Auth instances cache their settings on first use. Pin the test environment
// before any test module loads so the setup and normal instances always agree.
Bun.env.BETTER_AUTH_URL = 'http://localhost:3000'
Bun.env.BETTER_AUTH_SECRET = 'test-only-secret-at-least-32-characters'
Bun.env.GOOGLE_CLIENT_ID = 'test-client-id'
Bun.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
