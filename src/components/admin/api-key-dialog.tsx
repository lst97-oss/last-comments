'use client'

import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'

import { FormDialog } from '@/components/admin/form-dialog'
import { PermissionPicker } from '@/components/admin/permission-picker'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type Site } from '@/lib/admin-sites'
import {
  API_KEY_EXPIRY_OPTIONS,
  API_KEY_GUIDE_PATH,
  type ApiKeyForm,
  apiKeyFormSchema,
  DEFAULT_API_KEY_EXPIRY,
  DEFAULT_API_KEY_SCOPES,
  expiresInFor,
  scopesForSite,
} from '@/lib/api-keys'
import { readApiData } from '@/lib/api-response'
import { copyText } from '@/lib/clipboard'

// An API key is a server credential, so each one is bound to exactly one site.
// After a key is created the dialog shows only its secret. Another key needs the dialog to be closed and opened again.
export function ApiKeyCreateDialog({
  open,
  onOpenChange,
  sites = [],
  fixedSite,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sites?: Site[]
  fixedSite?: Pick<Site, 'key' | 'name' | 'access' | 'gatewayOnly'>
  onCreated?: () => void
}) {
  const [secret, setSecret] = useState<string | null>(null)
  const [error, setError] = useState('')
  const created = secret !== null

  const createMutation = useMutation({
    mutationFn: async ({ expiry, ...value }: ApiKeyForm) => {
      const expiresIn = expiresInFor(expiry)
      const response = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // The server body is strict, so the form-only expiry goes out as seconds, or not at all.
        body: JSON.stringify({ ...value, ...(expiresIn === undefined ? {} : { expiresIn }) }),
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
    // Least privilege by default: a key that registers and reads pages, plus the comment scopes the site needs.
    defaultValues: {
      name: '',
      siteKey: fixedSite?.key ?? '',
      scopes: scopesForSite(DEFAULT_API_KEY_SCOPES, fixedSite ?? {}),
      expiry: DEFAULT_API_KEY_EXPIRY,
    } as ApiKeyForm,
    validators: { onChange: apiKeyFormSchema },
    onSubmit: async ({ value }) => {
      setError('')
      setSecret(null)
      // The mutation reports its own failure; the form stays on the dialog.
      await createMutation.mutateAsync(value).catch(() => undefined)
    },
  })

  // Confirming ends this key's dialog; the next key starts from a fresh, reopened dialog.
  function confirmSecret() {
    setSecret(null)
    setError('')
    form.reset()
    onOpenChange(false)
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={created ? 'API key created' : 'Create API key'}
      description={
        created
          ? 'Copy the secret now. It is shown only once. Confirm to close this dialog, then open it again to create another key.'
          : fixedSite
            ? `Optional. Your site key ${fixedSite.key} already works for embeds. An API key lets your server call the comments service, and its secret is shown once.`
            : 'Each API key belongs to one site. Its secret is shown once, when you create it.'
      }
      error={error}
      submitLabel={created ? 'Confirm' : 'Create API key'}
      pendingLabel="Creating…"
      cancelLabel={fixedSite ? 'Skip' : 'Cancel'}
      onConfirm={created ? confirmSecret : undefined}
      contentClassName="sm:max-w-lg"
      form={form}
      onReset={() => {
        setSecret(null)
        setError('')
      }}
    >
      <FieldGroup>
        {secret ? (
          <Field>
            <FieldLabel htmlFor="api-key-secret">Secret — copy it now, it is not shown again</FieldLabel>
            <InputGroup>
              <InputGroupInput id="api-key-secret" readOnly value={secret} className="font-mono text-xs" />
              <InputGroupAddon align="inline-end">
                <InputGroupButton aria-label="Copy secret" onClick={() => void copyText(secret, 'Secret copied')}>
                  <Copy />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        ) : (
          <>
            {fixedSite === undefined && (
              <form.Field
                name="siteKey"
                children={(field) => {
                  const invalid = !field.state.meta.isValid
                  return (
                    <Field data-invalid={invalid}>
                      <FieldLabel htmlFor="api-key-site">Site</FieldLabel>
                      <Select
                        items={sites.map((site) => ({ value: site.key, label: `${site.name} (${site.key})` }))}
                        value={field.state.value || null}
                        onValueChange={(value) => {
                          const siteKey = value ?? ''
                          field.handleChange(siteKey)
                          // The comment features follow the chosen site's access setting; page features stay as chosen.
                          const site = sites.find((candidate) => candidate.key === siteKey)
                          if (site) form.setFieldValue('scopes', scopesForSite(form.getFieldValue('scopes'), site))
                        }}
                      >
                        <SelectTrigger id="api-key-site" className="w-full" aria-invalid={invalid}>
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
                    <FieldLabel htmlFor="api-key-name">Name</FieldLabel>
                    <Input
                      id="api-key-name"
                      placeholder="Production proxy"
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
              name="expiry"
              children={(field) => (
                <Field>
                  <FieldLabel htmlFor="api-key-expiry">Expires</FieldLabel>
                  <Select
                    items={API_KEY_EXPIRY_OPTIONS}
                    value={field.state.value}
                    onValueChange={(value) => {
                      const option = API_KEY_EXPIRY_OPTIONS.find((candidate) => candidate.value === value)
                      if (option) field.handleChange(option.value)
                    }}
                  >
                    <SelectTrigger id="api-key-expiry" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {API_KEY_EXPIRY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
            <form.Subscribe
              selector={(state) => state.values.siteKey}
              children={(siteKey) => (
                <form.Field
                  name="scopes"
                  children={(field) => (
                    <FieldSet>
                      <FieldLegend variant="label">Permissions</FieldLegend>
                      <PermissionPicker
                        idPrefix="api-key"
                        scopes={field.state.value}
                        site={fixedSite ?? sites.find((item) => item.key === siteKey)}
                        onChange={(next) => field.handleChange(next)}
                      />
                      <FieldDescription>
                        Not sure which permissions to tick?{' '}
                        <a
                          href={API_KEY_GUIDE_PATH}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 underline underline-offset-4"
                        >
                          Read the API key guide
                          <ExternalLink aria-hidden className="size-3" />
                        </a>
                      </FieldDescription>
                      {!field.state.meta.isValid && <FieldError errors={field.state.meta.errors} />}
                    </FieldSet>
                  )}
                />
              )}
            />
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
          </>
        )}
      </FieldGroup>
    </FormDialog>
  )
}
