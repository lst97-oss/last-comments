import { getBusinessDb } from '@/server/db/business-sql'
import { siteOrigins } from '@/server/db/schema'

// Every origin any site has registered. The auth layer reads it for trusted
// origins and credentialed CORS. It lives apart from comment-repository on
// purpose: that module imports route guards, which import auth, so reaching it
// from auth would close an import cycle.
export async function listRegisteredOrigins(): Promise<string[]> {
  const rows = await getBusinessDb().select({ origin: siteOrigins.origin }).from(siteOrigins)
  return [...new Set(rows.map((row) => row.origin))]
}
