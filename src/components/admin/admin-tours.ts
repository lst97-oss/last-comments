// Guided tours for the admin screens. Each step anchors on a data-tour attribute in the UI, and
// tests/admin-tours.test.ts fails when an anchor is renamed or removed. Steps marked skipMissing
// anchor on rows or cards that exist only when data does, so an empty instance still gets a tour.
// The blog example slug matches the post the seed creates, so the integration step stays concrete.

// The post the blog seed creates; its thread uses this slug as the page key.
export const BLOG_EXAMPLE_SLUG = 'introducing-last-comments'
// The seed's title for that post, so the example page reads the same as the blog.
export const BLOG_EXAMPLE_TITLE = 'Introducing last-comments: self-hosted comments for any site'
export const BLOG_EXAMPLE_PATH = `/blog/${BLOG_EXAMPLE_SLUG}`

// The tour fills the create-site form with this deployment's public origin, so the example matches
// each deploy. It never submits the form.
export function siteExample(publicOrigin: string): { name: string; origin: string } {
  const url = new URL(publicOrigin)
  return { name: url.hostname, origin: url.origin }
}

// driver.js only highlights; the tour's action button dispatches this event for the app to handle.
export const FILL_SITE_EXAMPLE_EVENT = 'admin-tour:fill-site-example'
export const FILL_PAGE_EXAMPLE_EVENT = 'admin-tour:fill-page-example'

export type AdminTourStep = {
  anchor: string
  // Highlighted instead when the anchor is absent, e.g. an empty-state card in place of a list.
  fallback?: string
  title: string
  description: string
  skipMissing?: boolean
  // Extra popover button: it ends the tour, then clicks a control on the page or dispatches an event.
  action?: AdminTourAction
}

export type AdminTourAction = { label: string; click: string } | { label: string; event: string }

export type AdminTour = {
  id: string
  steps: AdminTourStep[]
}

export const API_KEYS_TOUR: AdminTour = {
  id: 'api-keys',
  steps: [
    {
      anchor: 'api-keys-intro',
      title: 'Server keys, not page keys',
      description:
        'A site key is public and goes into your page embed. An API key is a secret for your server. Each key is bound to one site and can do only what its permissions allow.',
    },
    {
      anchor: 'api-keys-create',
      title: 'Create a key',
      description:
        'Pick the site, name the key, and choose its expiry (one year by default). The comment permissions are ticked to match the site, so tick only the page permissions your server needs. The secret is shown once, so copy it straight away.',
      action: { label: 'Open the create form', click: 'api-keys-create' },
    },
    {
      anchor: 'api-keys-list',
      title: 'Manage keys',
      description:
        'Each row shows its site and scopes. Switch a key off to pause it, or change its scopes and save. Deleting a key stops whatever uses it straight away.',
      skipMissing: true,
    },
    {
      anchor: 'api-keys-instance',
      title: 'Instance keys',
      description:
        'A key with no site can create and manage sites on this instance. Keep it off the servers that only serve one site.',
      skipMissing: true,
    },
  ],
}

export const MODERATION_TOUR: AdminTour = {
  id: 'moderation',
  steps: [
    {
      anchor: 'moderation-intro',
      title: 'Moderation is per site',
      description:
        'Every list here belongs to the site you pick. Actions on one site do not change comments on another.',
    },
    {
      anchor: 'moderation-site',
      title: 'Pick a site',
      description:
        'Switch sites with this menu. Use the Moderation items in the sidebar to move between Pages, Recent, Users and Sites.',
      skipMissing: true,
    },
    {
      anchor: 'moderation-views',
      title: 'What each view does',
      description:
        'Pages: lock a thread to stop new comments, or delete a page with its comments, replies and votes. Deleting is permanent. Recent: hide a comment to take it off the public thread, or restore it. Users: block someone to stop them posting on this site. Sites: create sites and change their settings.',
      skipMissing: true,
    },
    {
      anchor: 'pages-create',
      title: 'Register a page',
      description:
        'New page registers a thread before its first comment, from a URL, a page key and a title. The page key stays the same when the URL changes. The example fills in the blog post, whose page key is its slug. The form only fills in: press Create page to save it.',
      action: { label: 'Fill in the example post', event: FILL_PAGE_EXAMPLE_EVENT },
      skipMissing: true,
    },
    {
      anchor: 'pages-embed',
      title: 'Connect a page',
      description: `Copy embed config gives the widget its site key, page URL and page key. The page key is the post slug, so the thread survives a URL change. The example is the blog post ${BLOG_EXAMPLE_SLUG}: its page at /blog/${BLOG_EXAMPLE_SLUG} passes the same three values.`,
      skipMissing: true,
    },
  ],
}

export const SITES_TOUR: AdminTour = {
  id: 'sites',
  steps: [
    {
      anchor: 'sites-card',
      title: 'Sites',
      description:
        'A site is where comments appear, such as a blog or docs site. It has a public site key for its embed and at least one allowed origin.',
    },
    {
      anchor: 'sites-create',
      title: 'Create a site',
      description:
        'Creating a site generates its site key and registers the first allowed origin. Only the instance admin can create sites. Create an API key on the API keys page only when a server needs one.',
      action: { label: 'Fill in the example site', event: FILL_SITE_EXAMPLE_EVENT },
    },
    {
      anchor: 'sites-table',
      fallback: 'sites-empty',
      title: 'Your sites',
      description:
        'Each row shows the site key, its allowed origins, and your role. Copy the key into your embed. With no sites yet, this card shows an empty state instead.',
      skipMissing: true,
    },
    {
      anchor: 'sites-edit',
      title: 'Site settings',
      description:
        'Who can comment is the access setting: Open, Sign in to post, or Private. It decides what visitors without a key may do. Its ? icon explains each option. Maximum comment length, where blank means 10,000. Allow votes. Accept requests only through my host: when on, the service refuses any caller without a site-bound key, so only your host can read or post.',
      action: { label: 'Open the settings', click: 'sites-edit' },
      skipMissing: true,
    },
    {
      anchor: 'sites-delete',
      title: 'Deleting a site',
      description:
        'Deleting a site removes its pages and comments, and the API keys bound to it. This cannot be undone.',
      skipMissing: true,
    },
  ],
}
