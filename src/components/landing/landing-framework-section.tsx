'use client'

import { cn } from 'cn'

import { AngularIcon, HtmlIcon, ReactIcon, VueIcon } from '@/components/landing/framework-icons'
import { LandingCodeBlock } from '@/components/landing/landing-code-block'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const FRAMEWORKS = [
  {
    id: 'react',
    icon: ReactIcon,
    name: 'React',
    detail: 'React 19',
    lang: 'tsx',
    snippet: `import { Comments } from '@lst97-oss/last-comments-widgets/react'
import '@lst97-oss/last-comments-widgets/react/styles.css'

export function Thread() {
  return (
    <Comments
      baseUrl="https://comments.example.com"
      site="blog"
      pageUrl="https://example.com/blog/hello"
      turnstileSiteKey="0x4AAAAAA..."
    />
  )
}`,
  },
  {
    id: 'vue',
    icon: VueIcon,
    name: 'Vue',
    detail: 'Vue 3.5',
    lang: 'vue',
    snippet: `<script setup lang="ts">
import { Comments } from '@lst97-oss/last-comments-widgets/vue'
import '@lst97-oss/last-comments-widgets/vue/styles.css'
</script>

<template>
  <Comments
    base-url="https://comments.example.com"
    site="blog"
    page-url="https://example.com/blog/hello"
    turnstile-site-key="0x4AAAAAA..."
  />
</template>`,
  },
  {
    id: 'angular',
    icon: AngularIcon,
    name: 'Angular',
    detail: 'Angular 22',
    lang: 'ts',
    snippet: `import { Component } from '@angular/core'
import { LcCommentsComponent } from '@lst97-oss/last-comments-widgets/angular'
import '@lst97-oss/last-comments-widgets/angular/styles.css'

@Component({
  imports: [LcCommentsComponent],
  template: \`<lc-comments
    baseUrl="https://comments.example.com"
    site="blog"
    pageUrl="https://example.com/blog/hello"
  />\`,
})
export class ThreadComponent {}`,
  },
  {
    id: 'html',
    icon: HtmlIcon,
    name: 'HTML',
    detail: 'No build step',
    lang: 'html',
    snippet: `<link rel="stylesheet" href="https://unpkg.com/@lst97-oss/last-comments-widgets/dist/vanilla/styles.css" />

<div
  data-lc-comments
  data-lc-site="blog"
  data-lc-base-url="https://comments.example.com"
  data-lc-page-url="https://example.com/blog/hello"
></div>

<script type="module" src="https://unpkg.com/@lst97-oss/last-comments-widgets/dist/vanilla/index.js"></script>`,
  },
] as const

const FACETS = [
  {
    id: 'scoped-styles',
    label: 'Scoped styles',
    description:
      'The theme compiles Tailwind v4 preflight and utilities inside @scope (.lc-comments, .lc-theme), so the widget ships its own reset and never touches the host page.',
  },
  {
    id: 'theme-tokens',
    label: 'Theme tokens',
    description:
      'THEME_CSS_VARIABLES maps every knob to a CSS variable — primaryForeground becomes --primary-foreground. themeVarsToStyle(theme, dark) merges vars and dark overrides into inline custom properties on the widget root.',
  },
  {
    id: 'one-client',
    label: 'One client',
    description:
      'createClient() in @last-comments-widgets/client is the whole request layer. React, Vue, Angular and the vanilla port are thin views over it, published from one versioned package.',
  },
  {
    id: 'thread-paging',
    label: 'Thread paging',
    description:
      'loadThreadWindow() keeps fetching rows until N whole threads are loaded, and buildCommentTree() groups the flat list by parentId — orphan replies attach to the root instead of disappearing.',
  },
  {
    id: 'own-fetch',
    label: 'Bring your own fetch',
    description:
      'Every widget accepts fetchImpl: typeof fetch for logging or a same-origin proxy. Requests still send credentials: include, so the proxy stays a one-liner.',
  },
  {
    id: 'typed-errors',
    label: 'Typed errors',
    description:
      'ApiError carries a literal ApiErrorCode union, and describeError() maps a code to { title, message, action } — the same copy in every framework port.',
  },
] as const

export function LandingFrameworkSection() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold tracking-wide uppercase">Framework</h2>
      <div className="border-t border-border" />
      <p className="text-muted-foreground">One client, four widgets, and a theme that stays out of your page.</p>

      <Tabs
        className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] md:items-start"
        defaultValue={FRAMEWORKS[0].id}
      >
        {FRAMEWORKS.map((framework) => (
          <TabsContent
            className="col-start-1 row-start-1 min-w-0 md:col-span-2"
            key={framework.id}
            value={framework.id}
          >
            <LandingCodeBlock code={framework.snippet} lang={framework.lang} />
          </TabsContent>
        ))}

        {/* The variant utility `group-data-horizontal/tabs:h-8` outranks a
            plain `h-auto`, so the height is overridden on the same variant. */}
        <TabsList className="group-data-horizontal/tabs:h-auto col-start-1 row-start-2 grid w-full grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border p-0">
          {FRAMEWORKS.map((framework) => (
            <TabsTrigger
              className="h-auto flex-col items-start justify-start gap-1.5 rounded-none border-0 bg-background px-4 py-3 text-left data-active:bg-muted data-active:text-foreground"
              key={framework.id}
              value={framework.id}
            >
              <span className="flex items-center gap-2">
                <framework.icon className="size-4 text-muted-foreground" />
                <span className="font-mono text-sm font-medium">{framework.name}</span>
              </span>
              <span className="text-xs text-muted-foreground">{framework.detail}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <FacetPanel className="col-start-1 row-start-3 md:col-start-2 md:row-start-2" />
      </Tabs>
    </section>
  )
}

function FacetPanel({ className }: { className?: string }) {
  return (
    <Tabs
      className={cn(
        'grid gap-0 overflow-hidden rounded-lg border border-border md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]',
        className,
      )}
      defaultValue={FACETS[0].id}
      orientation="vertical"
    >
      <TabsList
        className="col-start-1 row-start-1 w-full flex-col items-stretch gap-0 divide-y divide-border border-b border-border md:border-b-0 md:border-r"
        variant="line"
      >
        {FACETS.map((facet) => (
          <TabsTrigger
            className="justify-start px-3 py-2.5 text-left font-mono text-xs tracking-wide uppercase data-active:bg-muted/60 data-active:text-foreground data-active:after:opacity-100"
            key={facet.id}
            value={facet.id}
          >
            {facet.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {FACETS.map((facet) => (
        <TabsContent
          className="col-start-1 row-start-2 px-4 py-4 text-sm text-muted-foreground md:col-start-2 md:row-start-1"
          key={facet.id}
          value={facet.id}
        >
          {facet.description}
        </TabsContent>
      ))}
    </Tabs>
  )
}
