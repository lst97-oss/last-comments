'use client'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { RANGES, type Range } from '@/lib/admin-format'

export function RangeToggle({ days, onChange }: { days: Range; onChange: (days: Range) => void }) {
  return (
    <ToggleGroup
      aria-label="Time range"
      value={[days]}
      onValueChange={(next) => {
        const picked = next[0]
        if (picked === '7' || picked === '30' || picked === '90') onChange(picked)
      }}
    >
      {RANGES.map((option) => (
        <ToggleGroupItem key={option} value={option} variant="outline" size="sm">
          {option}D
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
