export const RANGES = ['7', '30', '90'] as const
export type Range = (typeof RANGES)[number]

export type ModerationView = 'pages' | 'recent' | 'users' | 'sites'

export function asModerationView(value: unknown): ModerationView {
  return value === 'recent' || value === 'users' || value === 'sites' ? value : 'pages'
}

export const ACTION_LABELS: Record<string, string> = {
  hide: 'Comment hidden',
  restore: 'Comment restored',
  delete: 'Comment deleted',
  pin: 'Comment pinned',
  unpin: 'Comment unpinned',
  'page.lock': 'Page locked',
  'page.unlock': 'Page unlocked',
  'user.block': 'User blocked',
  'user.unblock': 'User unblocked',
}

export function threadLabel(title: string | null, canonicalUrl: string): string {
  if (title) return title
  const path = canonicalUrl.split('?')[0]?.replace(/\/$/, '') ?? canonicalUrl
  return path.split('/').filter(Boolean).pop() ?? canonicalUrl
}

export function formatDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return day
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function timeAgo(value: string | null): string {
  if (!value) return '—'
  const then = new Date(value).getTime()
  if (Number.isNaN(then)) return value
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export function authorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0]?.slice(0, 2) ?? '?').toUpperCase()
  return `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase()
}
