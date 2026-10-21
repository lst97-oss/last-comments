import { Link } from '@tanstack/react-router'

// Read once at module load: the footer must render the same year on the
// server and on the client, even across a new-year boundary.
const COPYRIGHT_YEAR = new Date().getFullYear()

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold tracking-tight">Last Comments</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Self-hosted comment threads for any page. Markdown bodies, moderation dashboard, and a publisher API.
          </p>
        </div>
        <nav aria-label="Product" className="flex flex-col gap-1">
          <p className="pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Product</p>
          <Link
            className="w-fit text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            to="/blog"
          >
            Blog
          </Link>
          <Link
            className="w-fit text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            to="/dashboard"
          >
            Dashboard
          </Link>
          <Link
            className="w-fit text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            to="/moderation"
            search={{ view: 'pages' }}
          >
            Moderation
          </Link>
        </nav>
        <nav aria-label="Resources" className="flex flex-col gap-1">
          <p className="pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Resources</p>
          <Link
            className="w-fit text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            to="/about"
          >
            About
          </Link>
          <Link
            className="w-fit text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            to="/admin"
          >
            Content admin
          </Link>
          <Link
            className="w-fit text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            to="/api-keys"
          >
            Publisher API keys
          </Link>
          <Link
            className="w-fit text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            to="/blog"
          >
            Release notes
          </Link>
        </nav>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground">
          <p>© {COPYRIGHT_YEAR} Last Comments</p>
          <p>Drop-in comment threads for any site.</p>
        </div>
      </div>
    </footer>
  )
}
