'use client'

import { MessageSquare } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ACTION_LABELS, formatDay } from '@/lib/admin-format'

export type StatsSeriesPoint = {
  day: string
  comments: number
  visible: number
  hidden: number
  votesUp: number
  votesDown: number
}

export type StatusTotals = {
  comments: number
  visible: number
  hidden: number
  deleted: number
}

export type ModerationActionCount = { action: string; count: number }

// Hoisted so the chart context and the tooltip keep a stable identity
// instead of a fresh object on every render.
const ACTIVITY_CONFIG = {
  visible: { label: 'Visible', color: 'var(--chart-1)' },
  hidden: { label: 'Hidden', color: 'var(--chart-2)' },
}
const STATUS_CONFIG = {
  visible: { label: 'Visible', color: 'var(--chart-1)' },
  hidden: { label: 'Hidden', color: 'var(--chart-2)' },
  deleted: { label: 'Deleted', color: 'var(--chart-3)' },
}
const VOTES_CONFIG = {
  votesUp: { label: 'Upvotes', color: 'var(--chart-1)' },
  votesDown: { label: 'Downvotes', color: 'var(--chart-2)' },
}
const RATE_CONFIG = { rate: { label: 'Visible', color: 'var(--chart-1)' } }

export function StatCard({
  title,
  description,
  value,
  footnote,
  action,
}: {
  title: string
  description: string
  value: string
  footnote: string
  action?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        {action}
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{footnote}</p>
      </CardContent>
    </Card>
  )
}

export function CommentActivityPanel({
  days,
  windowComments,
  series,
  className,
}: {
  days: number
  windowComments: number
  series: StatsSeriesPoint[]
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Comment activity</CardTitle>
        <CardDescription>Visible and hidden comments per day, last {days} days</CardDescription>
      </CardHeader>
      <CardContent>
        {windowComments === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No comments in this period</EmptyTitle>
              <EmptyDescription>Nothing was posted in the last {days} days.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ChartContainer config={ACTIVITY_CONFIG} className="aspect-auto h-[240px] w-full">
            <AreaChart accessibilityLayer data={series} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(value: string) => value.slice(5)}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => formatDay(String(value))} />} />
              <Area
                dataKey="visible"
                type="natural"
                fill="var(--color-visible)"
                fillOpacity={0.4}
                stroke="var(--color-visible)"
                stackId="a"
              />
              <Area
                dataKey="hidden"
                type="natural"
                fill="var(--color-hidden)"
                fillOpacity={0.4}
                stroke="var(--color-hidden)"
                stackId="a"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function CommentStatusPie({
  totals,
  emptyTitle,
  emptyDescription,
}: {
  totals: StatusTotals
  emptyTitle: string
  emptyDescription: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comment status</CardTitle>
        <CardDescription>All comments by status</CardDescription>
      </CardHeader>
      <CardContent>
        {totals.comments === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MessageSquare />
              </EmptyMedia>
              <EmptyTitle>{emptyTitle}</EmptyTitle>
              <EmptyDescription>{emptyDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ChartContainer config={STATUS_CONFIG} className="mx-auto aspect-square max-h-[260px]">
            <PieChart accessibilityLayer>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="status" />} />
              <Pie
                data={[
                  { status: 'visible', count: totals.visible, fill: 'var(--color-visible)' },
                  { status: 'hidden', count: totals.hidden, fill: 'var(--color-hidden)' },
                  { status: 'deleted', count: totals.deleted, fill: 'var(--color-deleted)' },
                ]}
                dataKey="count"
                nameKey="status"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={2}
              />
              <ChartLegend content={<ChartLegendContent nameKey="status" />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function VotesPanel({
  days,
  votesUp,
  votesDown,
  series,
}: {
  days: number
  votesUp: number
  votesDown: number
  series: StatsSeriesPoint[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Votes</CardTitle>
        <CardDescription>Upvotes and downvotes per day, last {days} days</CardDescription>
      </CardHeader>
      <CardContent>
        {votesUp + votesDown === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No votes in this period</EmptyTitle>
              <EmptyDescription>Nobody voted in the last {days} days.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ChartContainer config={VOTES_CONFIG} className="aspect-auto h-[220px] w-full">
            <BarChart accessibilityLayer data={series} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(value: string) => value.slice(5)}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => formatDay(String(value))} />} />
              <Bar dataKey="votesUp" fill="var(--color-votesUp)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="votesDown" fill="var(--color-votesDown)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function VisibleRatePanel({ totals }: { totals: StatusTotals }) {
  const visibleRate = totals.comments === 0 ? 0 : Math.round((totals.visible / totals.comments) * 100)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Visible rate</CardTitle>
        <CardDescription>Share of comments that are visible</CardDescription>
      </CardHeader>
      <CardContent>
        {totals.comments === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No comments to rate</EmptyTitle>
              <EmptyDescription>The rate appears once the first comment is posted.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="relative">
            <ChartContainer config={RATE_CONFIG} className="mx-auto aspect-square max-h-[220px]">
              <RadialBarChart
                accessibilityLayer
                data={[{ name: 'rate', value: visibleRate }]}
                startAngle={90}
                endAngle={-270}
                innerRadius="55%"
                outerRadius="100%"
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
                <RadialBar dataKey="value" fill="var(--color-rate)" cornerRadius={8} background />
              </RadialBarChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold tabular-nums">{visibleRate}%</span>
              <span className="text-xs text-muted-foreground">visible</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function ModerationActivityCard({
  days,
  moderationActions,
  scopeCopy,
}: {
  days: number
  moderationActions: ModerationActionCount[]
  scopeCopy: 'site' | 'thread'
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Moderation activity</CardTitle>
        <CardDescription>
          {scopeCopy === 'thread' ? `Actions on this thread, last ${days} days` : `Actions in the last ${days} days`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {moderationActions.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No moderation actions</EmptyTitle>
              <EmptyDescription>Nothing was hidden, deleted or locked in the last {days} days.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead className="text-right">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {moderationActions.map((item) => (
                <TableRow key={item.action}>
                  <TableCell className="font-medium">{ACTION_LABELS[item.action] ?? item.action}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.count.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export function SkeletonCards() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-40" />
    </div>
  )
}
