'use client'

import { CircleHelp, ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { API_KEY_GUIDE_PATH, API_KEY_GUIDE_SITE_SECTION } from '@/lib/api-keys'
import { SITE_ACCESS_LEVELS, type SiteAccess } from '@/lib/site-access'
import { SITE_ACCESS_LABELS } from '@/lib/site-schema'

// What a server needs when its visitors have no key, and how it must handle the key. The API key guide
// has the full table; keep these notes in step with it.
const SERVER_NOTES: Record<SiteAccess, string> = {
  open: 'No key is needed for comments. Add Show comments on pages only if your server loads the thread itself.',
  login:
    'Your server needs Post comments for visitors, because posting needs a sign-in. The key skips that check, so confirm the visitor is signed in before your server posts.',
  private:
    'Your server needs Show comments on pages and Post comments for visitors. Nothing is readable without a sign-in, so confirm sign-in on every request.',
}

// The three access options, explained in a bottom sheet so the site dialog stays where it is.
export function SiteAccessHelp() {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button type="button" variant="ghost" size="icon-sm" aria-label="What do the Who can comment options mean?" />
        }
      >
        <CircleHelp aria-hidden />
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Who can comment</SheetTitle>
          <SheetDescription>What visitors without an API key can do on this site.</SheetDescription>
        </SheetHeader>
        <ul className="flex flex-col gap-4 px-4">
          {SITE_ACCESS_LEVELS.map((level) => (
            <li key={level} className="flex flex-col gap-1">
              <p className="font-medium">{SITE_ACCESS_LABELS[level].label}</p>
              <p className="text-muted-foreground">{SITE_ACCESS_LABELS[level].description}</p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Your server:</span> {SERVER_NOTES[level]}
              </p>
            </li>
          ))}
        </ul>
        <p className="px-4 text-xs text-muted-foreground">
          Accept requests only through my host needs both comment permissions, whatever the option.
        </p>
        <div className="px-4 pb-4">
          <a
            href={`${API_KEY_GUIDE_PATH}#${API_KEY_GUIDE_SITE_SECTION}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4"
          >
            Read the API key guide
            <ExternalLink aria-hidden className="size-3.5" />
          </a>
        </div>
      </SheetContent>
    </Sheet>
  )
}
