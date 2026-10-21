import { Link } from '@tanstack/react-router'
import { ArrowUpRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

import { GITHUB_URL } from '@/lib/site-links'

const PRINCIPLES = [
  {
    number: '01',
    title: 'Universal core.',
    description: 'One API and one widget contract: threads work on any site, in any stack, without a per-site rebuild.',
    tags: ['one API', 'any site'],
  },
  {
    number: '02',
    title: 'Minimal by default.',
    description:
      'The core stays small — threads, identities, votes, moderation — and everything else arrives through the plugin concept.',
    tags: ['core', 'plugins'],
  },
  {
    number: '03',
    title: 'Theme adaptable.',
    description:
      'Theme tokens let the widget inherit the host design: light or dark, its radius, its colours. It reads as native, not bolted on.',
    tags: ['theme tokens', 'light / dark'],
  },
  {
    number: '04',
    title: 'Secure and standardized.',
    description:
      'Rate limiting, Turnstile and session handling ship in the box, so a new site inherits a reviewed implementation instead of repeating the same mistakes.',
    tags: ['rate limit', 'turnstile'],
  },
  {
    number: '05',
    title: 'Low cost.',
    description:
      'Self-hosted on a single Postgres. No per-seat pricing, no per-site plugin purchases — one instance serves many sites.',
    tags: ['self-hosted', 'one Postgres'],
  },
  {
    number: '06',
    title: 'Open and early.',
    description:
      'The API and the widget contracts may still move while the project is young. Feedback decides what lands next.',
    tags: ['early stage', 'open feedback'],
  },
] as const

export function AboutContent() {
  return (
    <div className="flex min-w-0 flex-col gap-12 py-8">
      <section className="flex flex-col gap-3">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-pretty">About Last Comments</h1>
        <p className="max-w-3xl text-muted-foreground">
          Last Comments is a universal, generic comment system: one secure, standardized core that works on every site,
          minimal out of the box and extended through a plugin concept, with theming that matches the design a site
          already has. Nobody should have to reinvent the wheel to ship comments.
        </p>
      </section>

      <Separator />

      <section aria-label="The goal" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-wide uppercase">The goal</h2>
        <p className="max-w-3xl text-muted-foreground">
          Comments are a solved problem, but every site solves it again — badly, expensively, or not at all. The goal
          here is a single core that carries the hard parts (identity, abuse, moderation, threading) and stays out of
          the way everywhere else: embed it, theme it, extend it with plugins, and keep the bill small by running it
          yourself.
        </p>
      </section>

      <section aria-label="Principles" className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold tracking-wide uppercase">Principles</h2>
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 xl:grid-cols-3">
          {PRINCIPLES.map((principle) => (
            <div key={principle.number} className="flex flex-col gap-2 bg-background p-5">
              <span className="font-mono text-xs text-muted-foreground">{principle.number}</span>
              <h3 className="font-semibold tracking-tight">{principle.title}</h3>
              <p className="text-sm text-muted-foreground">{principle.description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {principle.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Project status" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-wide uppercase">Project status</h2>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-5">
          <p className="text-sm">
            This is still a very early stage of development. Expect bugs, broken components and rough edges — some parts
            of the API and the widget contracts will still change.
          </p>
          <p className="text-sm text-muted-foreground">
            Feature requests and bug reports are welcome, and they decide what gets built next.
          </p>
        </div>
      </section>

      <section aria-label="Contact" className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-wide uppercase">Contact</h2>
        <p className="max-w-3xl text-muted-foreground">
          Reach the author at{' '}
          <a
            className="font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
            href="https://lst97.dev"
            rel="noopener noreferrer"
            target="_blank"
          >
            lst97.dev
          </a>
          , or discuss the project on the repository — feature requests and bug reports both belong there.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button render={<a href="https://lst97.dev" rel="noopener noreferrer" target="_blank" />}>
            lst97.dev
            <ArrowUpRight data-icon="inline-end" />
          </Button>
          <Button variant="outline" render={<a href={GITHUB_URL} rel="noopener noreferrer" target="_blank" />}>
            Repository
            <ArrowUpRight data-icon="inline-end" />
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3 scroll-mt-8" id="install">
        <h2 className="text-sm font-semibold tracking-wide uppercase">Get started</h2>
        <p className="max-w-3xl text-muted-foreground">
          Install the widget for your stack, register your site origin and embed a thread on any page.
        </p>
        <div>
          <Button render={<Link to="/docs/$" />}>Read the docs</Button>
        </div>
      </section>
    </div>
  )
}
