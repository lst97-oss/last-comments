import { eq } from 'drizzle-orm'

import { closeBusinessSql, getBusinessDb } from '@/server/db/business-sql'
import { instanceAdmins, user } from '@/server/db/schema'

const email = Bun.argv[2]?.trim().toLowerCase()
if (!email) throw new Error('Usage: bun run db:business:grant-admin -- <email>')

try {
  const db = getBusinessDb()
  const [account] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)
  if (!account) throw new Error(`No business auth account found for ${email}`)
  const [admin] = await db.select({ userId: instanceAdmins.userId }).from(instanceAdmins).limit(1)
  if (admin) throw new Error('An instance admin already exists')
  await db.insert(instanceAdmins).values({ userId: account.id })
  console.log(`Granted instance admin to ${email}`)
} finally {
  await closeBusinessSql()
}
