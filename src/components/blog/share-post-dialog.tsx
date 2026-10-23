import { Copy, Share2 } from 'lucide-react'
import { useRef } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { copyText } from '@/lib/clipboard'

export function SharePostDialog({
  url,
  title,
  description,
  image,
  imageAlt,
  hasCoverImage,
}: {
  url: string
  title: string
  description: string
  image: string
  imageAlt: string
  hasCoverImage: boolean
}) {
  // The URL input is the first tabbable element; autofocusing it would select
  // and scroll the long URL on open. Put focus on the action instead.
  const copyRef = useRef<HTMLButtonElement>(null)

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Share2 />
        Share
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" initialFocus={copyRef}>
        <DialogHeader>
          <DialogTitle>Share this page</DialogTitle>
          <DialogDescription>
            Copy the link below. The preview is what each platform reads from this page's Open Graph tags, exactly as a
            link preview would render it.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-lg border border-border">
          <p className="truncate border-b border-border bg-muted/50 px-3 py-1.5 font-mono text-xs text-muted-foreground">
            {url}
          </p>
          <img alt={imageAlt} className="aspect-[16/9] w-full border-b border-border object-cover" src={image} />
          <div className="flex flex-col gap-1 p-3">
            <p className="font-medium">{title}</p>
            <p className="line-clamp-3 text-sm text-muted-foreground">{description}</p>
          </div>
          {!hasCoverImage && (
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              Site default card — no cover image
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Input
            aria-label="Post URL"
            className="font-mono text-xs"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            value={url}
          />
          <Button className="w-fit" onClick={() => void copyText(url, 'Link copied')} ref={copyRef}>
            <Copy />
            Copy link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
