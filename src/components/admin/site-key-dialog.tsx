'use client'

import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Copy } from 'lucide-react'
import { useState } from 'react'

import { FormDialog } from '@/components/admin/form-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { readApiData } from '@/lib/api-response'
import { copyText } from '@/lib/clipboard'
import {
  DEFAULT_SITE_KEY_SCOPES,
  type KeyForm,
  keyFormSchema,
  SCOPE_LABELS,
  SITE_KEY_SCOPES,
  type Site,
} from '@/lib/site-keys'

// Site-key permissions are server-only, so creation always goes through the
// /api/admin/api-keys wrapper.
export function SiteKeyCreateDialog({
  open,
  onOpenChange,
  sites = [],
  fixedSite,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sites?: Site[]
  fixedSite?: { key: string; name: string }
  onCreated?: () => void
}) {
  const [secret, setSecret] = useState<string | null>(null)
  const [error, setError] = useState('')

  const createMutation = useMutation({
    mutationFn: async (value: KeyForm) => {
      const response = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(value),
      })
      const data = await readApiData<{ key: { key: string } }>(response)
      return data.key.key
    },
    onSuccess: (secretValue) => {
      setSecret(secretValue)
      form.reset()
      onCreated?.()
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : 'Could not create API key'),
  })

  const form = useForm({
    // Least privilege by default: a key that registers and reads pages.
    defaultValues: { name: '', siteKey: fixedSite?.key ?? '', scopes: [...DEFAULT_SITE_KEY_SCOPES] } as KeyForm,
    validators: { onChange: keyFormSchema },
    onSubmit: async ({ value }) => {
      setError('')
      setSecret(null)
      // The mutation reports its own failure; the form stays on the dialog.
      await createMutation.mutateAsync(value).catch(() => undefined)
    },
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create site key"
      description={
        fixedSite
          ? `Key for ${fixedSite.name} (${fixedSite.key}). Secrets are shown once at creation.`
          : 'Each key belongs to exactly one site, and the secret is shown once at creation.'
      }
      error={error}
      submitLabel="Create site key"
      pendingLabel="Creating…"
      form={form}
      onReset={() => {
        setSecret(null)
        setError('')
      }}
    >
      <FieldGroup>
        {fixedSite === undefined && (
          <form.Field
            name="siteKey"
            children={(field) => {
              const invalid = !field.state.meta.isValid
              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor="site-key-site">Site</FieldLabel>
                  <Select value={field.state.value || null} onValueChange={(value) => field.handleChange(value ?? '')}>
                    <SelectTrigger id="site-key-site" className="w-full" aria-invalid={invalid}>
                      <SelectValue placeholder="Pick a site" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {sites.map((site) => (
                          <SelectItem key={site.id} value={site.key}>
                            {site.name} ({site.key})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )
            }}
          />
        )}
        <form.Field
          name="name"
          children={(field) => {
            const invalid = !field.state.meta.isValid
            return (
              <Field data-invalid={invalid}>
                <FieldLabel htmlFor="site-key-name">Name</FieldLabel>
                <Input
                  id="site-key-name"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  maxLength={120}
                  aria-invalid={invalid}
                  required
                />
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )
          }}
        />
        <form.Field
          name="scopes"
          children={(field) => {
            const invalid = !field.state.meta.isValid
            return (
              <FieldSet>
                <FieldLegend>Permissions</FieldLegend>
                <FieldGroup>
                  {SITE_KEY_SCOPES.map((scope) => (
                    <Field key={scope} orientation="horizontal">
                      <Checkbox
                        id={`site-key-scope-${scope}`}
                        checked={field.state.value.includes(scope)}
                        onCheckedChange={() =>
                          field.handleChange(
                            field.state.value.includes(scope)
                              ? field.state.value.filter((item) => item !== scope)
                              : [...field.state.value, scope],
                          )
                        }
                      />
                      <FieldLabel htmlFor={`site-key-scope-${scope}`}>
                        {SCOPE_LABELS[scope]} <span className="text-muted-foreground">({scope})</span>
                      </FieldLabel>
                    </Field>
                  ))}
                </FieldGroup>
                {invalid && <FieldError errors={field.state.meta.errors} />}
              </FieldSet>
            )
          }}
        />
        {secret && (
          <Field>
            <FieldLabel htmlFor="site-key-secret">Secret — copy it now, it is not shown again</FieldLabel>
            <InputGroup>
              <InputGroupInput id="site-key-secret" readOnly value={secret} className="font-mono text-xs" />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label="Copy secret"
                  onClick={() => secret && void copyText(secret, 'Secret copied')}
                >
                  <Copy />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        )}
        {fixedSite === undefined && sites.length === 0 && (
          <Alert>
            <AlertDescription>
              No sites yet. Create a site first —{' '}
              <Link to="/moderation" search={{ view: 'sites' }}>
                go to Sites
              </Link>
              .
            </AlertDescription>
          </Alert>
        )}
      </FieldGroup>
    </FormDialog>
  )
}
