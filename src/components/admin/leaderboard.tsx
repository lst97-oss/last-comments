'use client'

import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress'

export type LeaderboardItem = {
  key: string
  label: string
  value: number
}

export function Leaderboard({
  items,
  renderLabel,
  ariaValueText,
  empty,
}: {
  items: LeaderboardItem[]
  renderLabel?: (item: LeaderboardItem) => React.ReactNode
  /** Screen-reader value text; the bar otherwise announces a percentage. */
  ariaValueText?: (item: LeaderboardItem) => string
  empty?: React.ReactNode
}) {
  if (items.length === 0) return empty ?? null
  const max = Math.max(1, ...items.map((item) => item.value))
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <Progress
          key={item.key}
          value={item.value}
          max={max}
          className="gap-1.5"
          aria-valuetext={ariaValueText?.(item)}
        >
          <ProgressLabel className="min-w-0 flex-1 truncate" title={item.label}>
            {renderLabel ? renderLabel(item) : item.label}
          </ProgressLabel>
          <ProgressValue>{() => item.value}</ProgressValue>
        </Progress>
      ))}
    </div>
  )
}
