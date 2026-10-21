import { and, eq } from 'drizzle-orm'

import { getBusinessDb } from '@/server/db/business-sql'
import { externalIdentities, instanceAdmins, user } from '@/server/db/schema'

export type ExternalIdentityInput = {
  provider: string
  subject: string
  email?: string | null
  displayName?: string | null
  emailVerified?: boolean
}

type BusinessDb = ReturnType<typeof getBusinessDb>

// Link an external subject to the canonical user.id, auto-provisioning on
// first login. Verified email matches an existing user (same human, new IdP);
// unverified emails never merge — a separate user is created so a forged
// claim cannot take over an account.
export async function linkOrProvisionExternalUser(
  input: ExternalIdentityInput,
  options?: { db?: BusinessDb; autoProvision?: boolean },
): Promise<{ userId: string; email: string | null; displayName: string | null }> {
  const db = options?.db ?? getBusinessDb()
  const autoProvision = options?.autoProvision ?? true
  const email = typeof input.email === 'string' && input.email.includes('@') ? input.email.toLowerCase() : null

  const [existing] = await db
    .select({ userId: externalIdentities.userId })
    .from(externalIdentities)
    .where(and(eq(externalIdentities.provider, input.provider), eq(externalIdentities.subject, input.subject)))
    .limit(1)
  if (existing) {
    const [row] = await db
      .select({ id: user.id, email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, existing.userId))
      .limit(1)
    if (!row) throw new Error('External identity points at a missing user')
    return { userId: row.id, email: row.email, displayName: row.name }
  }

  if (!autoProvision) throw new Error('Unknown external identity and auto-provision is disabled')

  if (email && input.emailVerified) {
    const [byEmail] = await db
      .select({ id: user.id, email: user.email, name: user.name })
      .from(user)
      .where(eq(user.email, email))
      .limit(1)
    if (byEmail) {
      await db
        .insert(externalIdentities)
        .values({ provider: input.provider, subject: input.subject, userId: byEmail.id, email })
      const [row] = await db
        .select({ id: user.id, email: user.email, name: user.name })
        .from(user)
        .where(eq(user.id, byEmail.id))
        .limit(1)
      if (!row) throw new Error('External identity points at a missing user')
      return { userId: row.id, email: row.email, displayName: row.name }
    }
  }

  const name = input.displayName?.trim() || (email ? email.split('@')[0] : `${input.provider}:${input.subject}`)
  const stubEmail = email ?? `${input.provider}+${input.subject}@invalid.local`
  const [created] = await db
    .insert(user)
    .values({ id: crypto.randomUUID(), name, email: stubEmail, emailVerified: input.emailVerified ?? false })
    .returning({ id: user.id, email: user.email, name: user.name })
  if (!created) throw new Error('Could not provision external user')
  await db
    .insert(externalIdentities)
    .values({ provider: input.provider, subject: input.subject, userId: created.id, email })
  return { userId: created.id, email: created.email, displayName: created.name }
}

// First-login bootstrap for external providers. The password setup flow
// (POST /api/initial-admin) requires zero user rows, so an external login on
// a fresh instance would otherwise strand it with users but no admin — the
// first external identity claims the singleton admin slot instead. With
// AUTH_BOOTSTRAP_EMAIL set, only that address may claim it. Returns whether
// this call claimed the slot; the unique slot + onConflictDoNothing make
// concurrent first logins safe.
export async function maybeBootstrapInstanceAdmin(
  userId: string,
  email: string | null,
  options?: { db?: BusinessDb; bootstrapEmail?: string },
): Promise<boolean> {
  const bootstrapEmail = options?.bootstrapEmail
  if (bootstrapEmail && (email ?? '').toLowerCase() !== bootstrapEmail.toLowerCase()) return false
  const db = options?.db ?? getBusinessDb()
  const existing = await db.select({ userId: instanceAdmins.userId }).from(instanceAdmins).limit(1)
  if (existing.length > 0) return false
  await db.insert(instanceAdmins).values({ slot: 1, userId }).onConflictDoNothing()
  return true
}
