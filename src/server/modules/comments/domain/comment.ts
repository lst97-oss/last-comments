import { ErrorCode, HttpError } from '@/server/http/errors'

const PAGE_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function normalizePageKey(value: string): string {
  const key = value.trim().toLowerCase()
  if (key.length === 0 || key.length > 120 || !PAGE_KEY_PATTERN.test(key)) {
    throw new HttpError(
      ErrorCode.INVALID_PAGE_KEY.status,
      ErrorCode.INVALID_PAGE_KEY.code,
      'Page key must be a lowercase slug like this-is-test',
    )
  }
  return key
}

export function normalizePageUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new HttpError(
      ErrorCode.INVALID_PAGE_URL.status,
      ErrorCode.INVALID_PAGE_URL.code,
      'Page URL must be an absolute HTTP URL',
    )
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new HttpError(
      ErrorCode.INVALID_PAGE_URL.status,
      ErrorCode.INVALID_PAGE_URL.code,
      'Page URL must be an absolute HTTP URL',
    )
  }

  url.hash = ''
  return url.toString()
}
