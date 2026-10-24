import { z } from 'zod'

const optionalOAuthCredential = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional(),
)

const businessAuthEnvSchema = z
  .object({
    BETTER_AUTH_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    GOOGLE_CLIENT_ID: optionalOAuthCredential,
    GOOGLE_CLIENT_SECRET: optionalOAuthCredential,
  })
  .refine(({ GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET }) => Boolean(GOOGLE_CLIENT_ID) === Boolean(GOOGLE_CLIENT_SECRET), {
    message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured together',
    path: ['GOOGLE_CLIENT_ID'],
  })

export function getBusinessAuthSettings(
  source: Record<string, string | undefined> = typeof Bun !== 'undefined' ? Bun.env : process.env,
  allowPasswordSignUp = false,
) {
  const env = businessAuthEnvSchema.parse(source)
  return {
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    emailAndPassword: { enabled: true as const, disableSignUp: !allowPasswordSignUp },
    // Google's own email_verified claim is the ownership proof. The first admin
    // signs up with email/password, which leaves that local row unverified, so
    // without requireLocalEmailVerified: false the Google sign-in is refused
    // with account_not_linked. Password sign-up is closed, so no one can
    // pre-register a victim's email.
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
        requireLocalEmailVerified: false,
      },
    },
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { socialProviders: { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } } }
      : {}),
  }
}
