'use client'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { isRange, RANGES, type Range } from '@/lib/admin-format'

export function RangeToggle({ days, onChange }: { days: Range; onChange: (days: Range) => void }) {
  return (
    <ToggleGroup
      aria-label="Time range"
      value={[days]}
      onValueChange={(next) => {
        const picked = next[0]
        if (picked && isRange(picked)) onChange(picked)
      }}
    >
      {RANGES.map((option) => (
        <ToggleGroupItem key={option} value={option} variant="outline" size="sm">
          {option === 'all' ? 'All' : `${option}D`}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
