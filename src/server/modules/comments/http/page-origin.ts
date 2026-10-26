import { ErrorCode, HttpError } from '@/server/http/errors'
import { normalizePageUrl } from '@/server/modules/comments/domain/comment'
import { assertSiteOrigin } from '@/server/modules/comments/infrastructure/comment-repository'

// A thread is created on an origin the caller speaks for. A browser may open threads
// on its own origin. A key may open them on any origin the site registered, which is
// how the host proxy's pages get in. Without this, any registered origin could open
// threads on arbitrary domains, and a key holder could claim pages the site never owned.
export async function assertPageOriginAllowed(
  caller: { keyId?: string | undefined; responseOrigin?: string | null | undefined },
  siteKey: string,
  pageUrl: string,
  registeredOrigin: (siteKey: string, origin: string) => Promise<string | null> = registeredOriginOrNull,
): Promise<void> {
  const pageOrigin = new URL(normalizePageUrl(pageUrl)).origin
  if (caller.keyId) {
    // Same rule and code as the publisher's upsertPage, so a key gets one answer for one condition.
    if ((await registeredOrigin(siteKey, pageOrigin)) === null) {
      throw new HttpError(
        ErrorCode.PAGE_ORIGIN_NOT_ALLOWED.status,
        ErrorCode.PAGE_ORIGIN_NOT_ALLOWED.code,
        `Page URL must use an allowed site origin: register ${pageOrigin} on this site first`,
      )
    }
    return
  }
  if (caller.responseOrigin !== pageOrigin) {
    throw new HttpError(
      ErrorCode.ORIGIN_NOT_ALLOWED.status,
      ErrorCode.ORIGIN_NOT_ALLOWED.code,
      'Page URL must be on the origin making the request',
    )
  }
}

// Null for an origin the site has not registered, so the caller can name it in the error.
async function registeredOriginOrNull(siteKey: string, origin: string): Promise<string | null> {
  try {
    return await assertSiteOrigin(siteKey, origin)
  } catch (error) {
    if (error instanceof HttpError && error.code === ErrorCode.ORIGIN_NOT_ALLOWED.code) return null
    throw error
  }
}
