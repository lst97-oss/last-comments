import { getBusinessEnv } from '@/server/config/business-env'

// Scripts that wipe or fill the business database call this first, so a production URL in the
// environment cannot be emptied or seeded by accident.
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

export function assertLocalBusinessTarget(): void {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run with NODE_ENV=production')
  const host = new URL(getBusinessEnv().connectionString).hostname
  if (!LOCAL_HOSTS.has(host)) throw new Error('Refusing to run: BUSINESS_DATABASE_URL is not a local database')
}
