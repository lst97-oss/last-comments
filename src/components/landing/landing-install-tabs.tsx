'use client'

import { LandingCodeBlock } from '@/components/landing/landing-code-block'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const INSTALL_COMMANDS = [
  { id: 'bun', label: 'Bun', command: 'bun add @lst97-oss/last-comments-widgets' },
  { id: 'npm', label: 'npm', command: 'npm install @lst97-oss/last-comments-widgets' },
  { id: 'pnpm', label: 'pnpm', command: 'pnpm add @lst97-oss/last-comments-widgets' },
  { id: 'yarn', label: 'Yarn', command: 'yarn add @lst97-oss/last-comments-widgets' },
] as const

export function LandingInstallTabs() {
  return (
    <Tabs defaultValue={INSTALL_COMMANDS[0].id}>
      <TabsList variant="line">
        {INSTALL_COMMANDS.map((entry) => (
          <TabsTrigger key={entry.id} value={entry.id}>
            {entry.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {INSTALL_COMMANDS.map((entry) => (
        <TabsContent key={entry.id} value={entry.id}>
          <LandingCodeBlock code={entry.command} lang="bash" />
        </TabsContent>
      ))}
    </Tabs>
  )
}
