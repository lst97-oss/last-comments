import { defineConfig } from 'drizzle-kit'

const url = process.env.BUSINESS_DATABASE_URL
if (!url) throw new Error('BUSINESS_DATABASE_URL is required for business migrations')

export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './drizzle/business',
  dialect: 'postgresql',
  dbCredentials: { url },
})
