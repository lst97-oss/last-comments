'use client'

import { useForm } from '@tanstack/react-form'
import { Copy, KeyRound, Pencil, Trash } from 'lucide-react'
import { useState } from 'react'
import { AccountTextField } from '@/components/admin/account-field'
import { ConfirmDeleteDialog } from '@/components/admin/confirm-delete-dialog'
import { FormDialog } from '@/components/admin/form-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { FieldGroup } from '@/components/ui/field'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { copyText } from '@/lib/clipboard'
import { type Site, type SiteRole } from '@/lib/site-keys'
import { type RenameSiteForm, renameSiteSchema, type SiteForm, siteFormSchema } from '@/lib/site-schema'

export function SitesView({
  sites,
  allSites,
  createOpen,
  onCreateOpen,
  onCreateSite,
  onRenameSite,
  onDeleteSite,
}: {
  sites: Site[]
  allSites: Site[]
  createOpen: boolean
  onCreateOpen: (open: boolean) => void
  onCreateSite: (values: SiteForm) => Promise<boolean>
  onRenameSite: (siteKey: string, name: string) => Promise<boolean>
  onDeleteSite: (siteKey: string) => Promise<boolean>
}) {
  // The React Compiler compiles this component (annotation mode, client bundle).
  'use memo'
  const form = useForm({
    defaultValues: { name: '', origin: '' } as SiteForm,
    validators: { onChange: siteFormSchema },
    onSubmit: async ({ value }) => {
      await onCreateSite(value)
    },
  })
  const [renameTarget, setRenameTarget] = useState<Site | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Site | null>(null)
  const [deleting, setDeleting] = useState(false)
  const renameForm = useForm({
    defaultValues: { name: '' } as RenameSiteForm,
    validators: { onChange: renameSiteSchema },
    onSubmit: async ({ value }) => {
      if (!renameTarget) return
      if (await onRenameSite(renameTarget.key, value.name)) setRenameTarget(null)
    },
  })
  const roles: Partial<Record<string, SiteRole>> = Object.fromEntries(sites.map((item) => [item.key, item.role]))

  function openRename(target: Site) {
    renameForm.reset()
    renameForm.setFieldValue('name', target.name)
    setRenameTarget(target)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      if (await onDeleteSite(deleteTarget.key)) setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Sites</CardTitle>
          <CardDescription>
            {allSites.length === 0
              ? 'No sites yet. Creating a site generates its key and registers its first allowed origin.'
              : `${allSites.length} ${allSites.length === 1 ? 'site' : 'sites'}. Site keys are minted on the API keys page.`}
          </CardDescription>
          <CardAction>
            <Button
              type="button"
              onClick={() => {
                form.reset()
                onCreateOpen(true)
              }}
            >
              Create site
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {allSites.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <KeyRound />
                </EmptyMedia>
                <EmptyTitle>No sites yet</EmptyTitle>
                <EmptyDescription>
                  Create your first site, then mint a site key to embed comments on your pages.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Allowed origin</TableHead>
                  <TableHead>Your role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allSites.map((item) => {
                  const role = roles[item.key]
                  const origins = item.origins ?? []
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <code className="text-xs text-muted-foreground">{item.key}</code>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Copy key for ${item.name}`}
                            onClick={() => void copyText(item.key, 'Site key copied')}
                          >
                            <Copy />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {origins[0] ?? '—'}
                        {origins.length > 1 && ` +${origins.length - 1}`}
                      </TableCell>
                      <TableCell>
                        {role ? (
                          <Badge variant="secondary">{role === 'admin' ? 'Site admin' : 'Moderator'}</Badge>
                        ) : (
                          <Badge variant="outline">Not a member</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => openRename(item)}>
                            <Pencil data-icon="inline-start" />
                            Rename
                          </Button>
                          <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTarget(item)}>
                            <Trash data-icon="inline-start" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <FormDialog
        open={createOpen}
        onOpenChange={onCreateOpen}
        title="Create site"
        description="The site key is generated automatically and this origin becomes the site's first allowed origin. Comments are only accepted from allowed origins."
        submitLabel="Create site"
        pendingLabel="Creating…"
        form={form}
      >
        <FieldGroup>
          <AccountTextField form={form} name="name" id="site-name" label="Name" maxLength={120} />
          <AccountTextField
            form={form}
            name="origin"
            id="site-origin"
            label="Allowed origin"
            type="url"
            maxLength={2048}
            description="Scheme and host only — no path, query, or fragment."
          />
        </FieldGroup>
      </FormDialog>
      <FormDialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null)
        }}
        title="Rename site"
        description={
          <>
            Only the name changes. The site key <code className="text-xs">{renameTarget?.key}</code> stays the same, so
            existing embeds keep working.
          </>
        }
        submitLabel="Save name"
        pendingLabel="Saving…"
        form={renameForm}
      >
        <FieldGroup>
          <AccountTextField form={renameForm} name="name" id="rename-site-name" label="Name" maxLength={120} />
        </FieldGroup>
      </FormDialog>
      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title={`Delete ${deleteTarget?.name}?`}
        description="This permanently deletes the site with its pages, comments, allowed origins, memberships, and site keys. This cannot be undone."
        confirmLabel="Delete site"
        pendingLabel="Deleting…"
        pending={deleting}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}
