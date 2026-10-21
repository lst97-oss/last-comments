'use client'

import { Hash, Lock, LockOpen } from 'lucide-react'

import { Badge } from '@/components/ui/badge'

export function ThreadStatusBadge({ isLocked }: { isLocked: boolean }) {
  return isLocked ? (
    <Badge variant="outline">
      <Lock />
      Locked
    </Badge>
  ) : (
    <Badge variant="secondary">
      <LockOpen />
      Open
    </Badge>
  )
}

export function ThreadKeyBadge({ pageKey }: { pageKey: string | null }) {
  return pageKey ? (
    <Badge variant="secondary">
      <Hash />
      {pageKey}
    </Badge>
  ) : (
    <Badge variant="outline">URL only</Badge>
  )
}
