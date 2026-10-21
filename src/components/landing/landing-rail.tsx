'use client'

import { Link } from '@tanstack/react-router'
import { ArrowRight, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { GithubIcon } from '@/components/landing/framework-icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GITHUB_URL } from '@/lib/site-links'

// Keep in sync with `SiteHeader` (`h-14`). The theme icons swap through CSS
// so the server render stays stable — only the click handler reads the
// resolved theme. `headingAs` demotes the rail headline on pages that carry
// their own h1 (the About page), so a page keeps exactly one h1.
export function LandingRail({ headingAs = 'h1' }: { headingAs?: 'h1' | 'h2' }) {
  const { resolvedTheme, setTheme } = useTheme()
  const Heading = headingAs

  return (
    <div className="flex flex-col gap-8 py-8 lg:sticky lg:top-14 lg:h-[calc(100svh-3.5rem)] lg:justify-between lg:overflow-clip">
      <div className="flex flex-col gap-4">
        <Badge variant="secondary" render={<Link to="/blog" />}>
          Announcement | Introducing Last Comments
          <ArrowRight aria-hidden />
        </Badge>
        <Heading className="max-w-md text-4xl font-semibold tracking-tight text-pretty">
          The most comprehensive self-hosted comments
        </Heading>
        <p className="max-w-md text-muted-foreground">
          Drop-in comment threads for any page: embed a site key, comment on URLs or stable page keys, moderate in the
          dashboard. Markdown bodies, guest and signed-in posting, votes, and a publisher API for sites that register
          their threads up front.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button render={<a href="#install" />}>Get started</Button>
          <Button variant="outline" render={<Link to="/dashboard" />}>
            Open dashboard
          </Button>
        </div>
      </div>

      {/* The ASCII comment animation, baked per theme: the artwork's own
          background is the page background, so it reads as ink on paper
          instead of a black rectangle. `38svh` keeps it inside the sticky
          rail on short viewports. */}
      <div
        aria-label="A comment bubble writing out a message"
        className="mx-auto aspect-[1069/780] w-[min(380px,38svh)] shrink-0 bg-[url('/assets/ascii-magic-comment-light.webp')] bg-contain bg-center bg-no-repeat dark:bg-[url('/assets/ascii-magic-comment-dark.webp')]"
        role="img"
      />

      <div className="flex flex-wrap items-center gap-4">
        <Link className="text-xs text-muted-foreground hover:text-foreground" to="/blog">
          Blog
        </Link>
        <Link className="text-xs text-muted-foreground hover:text-foreground" to="/docs/$">
          Docs
        </Link>
        <Link
          className="text-xs text-muted-foreground hover:text-foreground"
          to="/moderation"
          search={{ view: 'pages' }}
        >
          Moderation
        </Link>
        <Link className="text-xs text-muted-foreground hover:text-foreground" to="/admin">
          Content admin
        </Link>
        <Button
          className="ml-auto"
          render={<a aria-label="GitHub" href={GITHUB_URL} rel="noopener noreferrer" target="_blank" title="GitHub" />}
          size="icon-sm"
          variant="ghost"
        >
          <GithubIcon />
        </Button>
        <Button
          aria-label="Toggle theme"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          size="icon-sm"
          variant="ghost"
        >
          <Sun aria-hidden className="hidden dark:block" />
          <Moon aria-hidden className="block dark:hidden" />
        </Button>
      </div>
    </div>
  )
}
