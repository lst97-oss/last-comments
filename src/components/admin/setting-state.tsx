'use client'

import { cn } from 'cn'
import { type LucideIcon } from 'lucide-react'
import { type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'

// Tones are the theme's status colours. The icon and the state word carry the meaning, so colour is never the only cue.
export type SettingTone = 'success' | 'warning' | 'info' | 'neutral'

export type SettingView = {
  tone: SettingTone
  icon: LucideIcon
  state: string
  meaning: string
}

const TINT: Record<SettingTone, string> = {
  success: 'bg-success-muted',
  warning: 'bg-warning-muted',
  info: 'bg-info-muted',
  neutral: 'bg-muted',
}

const ICON_TONE: Record<SettingTone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
  neutral: 'text-muted-foreground',
}

export function SettingState({
  tone,
  icon: Icon,
  children,
}: {
  tone: SettingTone
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <Badge variant="outline" className={cn('border-transparent', TINT[tone])}>
      <Icon aria-hidden className={ICON_TONE[tone]} />
      {children}
    </Badge>
  )
}

// One setting: its label, what the current state means, and the state itself. Renders inside a <dl>.
export function SettingRow({ label, view }: { label: string; view: SettingView }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{view.meaning}</span>
      </dt>
      <dd className="shrink-0">
        <SettingState tone={view.tone} icon={view.icon}>
          {view.state}
        </SettingState>
      </dd>
    </div>
  )
}
