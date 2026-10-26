'use client'

import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { z } from 'zod'

import {
  BLOG_EXAMPLE_PATH,
  BLOG_EXAMPLE_SLUG,
  BLOG_EXAMPLE_TITLE,
  FILL_PAGE_EXAMPLE_EVENT,
} from '@/components/admin/admin-tours'
import { FormDialog } from '@/components/admin/form-dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group'
import { useWindowEvent } from '@/hooks/use-window-event'
import { readApiData } from '@/lib/api-response'

// A bare path is joined to the site's origin; a pasted full URL must already
// be on one of the site's allowed origins. The server enforces the same rule.
function pageUrlFrom(input: string, origin: string, origins: string[]): string | null {
  const value = input.trim()
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value)
      return origins.includes(url.origin) ? url.toString() : null
    } catch {
      return null
    }
  }
  if (!value.startsWith('/')) return null
  try {
    return new URL(`${origin}${value}`).toString()
  } catch {
    return null
  }
}

// Mirrors the server's domain rules (normalizePageUrl / normalizePageKey);
// guarded refinements matter: zod keeps running checks after a failed one.
function pageFormSchema(origin: string, origins: string[]) {
  const url = z
    .string()
    .trim()
    .max(2048)
    .refine((value) => {
      try {
        return ['http:', 'https:'].includes(new URL(value).protocol)
      } catch {
        return false
      }
    }, 'Enter an absolute HTTP or HTTPS URL')
  const path = z
    .string()
    .max(2048)
    .refine(
      (value) => pageUrlFrom(value, origin, origins) !== null,
      `Enter a path like /first-post — or paste a full URL on ${origins.join(' or ') || 'an allowed origin'}`,
    )
  const hasOrigins = origins.length > 0
  return z.object({
    url: hasOrigins ? z.string() : url,
    path: hasOrigins ? path : z.string(),
    pageKey: z
      .string()
      .trim()
      .max(120)
      .refine(
        // Server normalizePageKey lowercases; accept mixed case here too.
        (value) => value === '' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.toLowerCase()),
        'Page key must be a lowercase slug like first-post',
      ),
    title: z.string().trim().max(300),
  })
}

type PageForm = {
  url: string
  path: string
  pageKey: string
  title: string
}

export function PageCreateDialog({
  open,
  onOpenChange,
  site,
  origins,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  site: string
  /** The site's allowed origins; the first one is the read-only URL prefix. */
  origins: string[]
  onCreated: () => void
}) {
  const [error, setError] = useState('')
  const origin = origins[0] ?? ''
  const schema = pageFormSchema(origin, origins)

  const createMutation = useMutation({
    mutationFn: async (body: { site: string; url: string; pageKey?: string; title?: string }) => {
      const response = await fetch('/api/admin/pages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      await readApiData<{ page: { id: string } }>(response)
    },
    onSuccess: () => {
      form.reset()
      onOpenChange(false)
      onCreated()
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : 'Could not create the page'),
  })

  const form = useForm({
    defaultValues: { url: '', path: '', pageKey: '', title: '' } as PageForm,
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      setError('')
      const url = origins.length > 0 ? pageUrlFrom(value.path, origin, origins) : value.url.trim()
      if (url === null) {
        setError('Enter a path on one of the site’s allowed origins.')
        return
      }
      // The mutation reports its own failure; the form stays on the dialog.
      await createMutation
        .mutateAsync({
          site,
          url,
          ...(value.pageKey === '' ? {} : { pageKey: value.pageKey }),
          ...(value.title === '' ? {} : { title: value.title }),
        })
        .catch(() => undefined)
    },
  })

  // The tour's example button opens the form with the seeded blog post filled in. It never submits.
  useWindowEvent(FILL_PAGE_EXAMPLE_EVENT, () => {
    form.reset()
    form.setFieldValue('path', BLOG_EXAMPLE_PATH)
    form.setFieldValue('pageKey', BLOG_EXAMPLE_SLUG)
    form.setFieldValue('title', BLOG_EXAMPLE_TITLE)
    onOpenChange(true)
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New page"
      description={
        <>
          Registers the thread before the first comment arrives. Pages are normally created by their first comment; this
          makes the URL, key, and title explicit — a publishing server can do the same with a pages:write key on POST
          /api/admin/pages.
        </>
      }
      error={error}
      submitLabel="Create page"
      pendingLabel="Creating…"
      form={form}
      onReset={() => setError('')}
    >
      <FieldGroup>
        {origins.length > 0 ? (
          <form.Field
            name="path"
            children={(field) => {
              const invalid = !field.state.meta.isValid
              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor="page-path">Page URL</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon align="inline-start">
                      <InputGroupText>{origin}</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="page-path"
                      placeholder="/first-post"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      maxLength={2048}
                      aria-invalid={invalid}
                      required
                    />
                  </InputGroup>
                  <FieldDescription>
                    Path on the site’s allowed origin — its scheme and host are fixed. Pasting a full URL is fine as
                    long as it uses {origins.length > 1 ? 'one of the allowed origins' : 'that origin'}.
                  </FieldDescription>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )
            }}
          />
        ) : (
          <form.Field
            name="url"
            children={(field) => {
              const invalid = !field.state.meta.isValid
              return (
                <Field data-invalid={invalid}>
                  <FieldLabel htmlFor="page-url">Page URL</FieldLabel>
                  <Input
                    id="page-url"
                    type="url"
                    placeholder="https://blog.example.com/first-post"
                    value={field.state.value}
                    onChange={(event) => field.handleChange(event.target.value)}
                    onBlur={field.handleBlur}
                    maxLength={2048}
                    aria-invalid={invalid}
                  />
                  <FieldDescription>
                    This site has no allowed origin recorded, so the URL cannot be checked against one.
                  </FieldDescription>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )
            }}
          />
        )}
        <form.Field
          name="pageKey"
          children={(field) => {
            const invalid = !field.state.meta.isValid
            return (
              <Field data-invalid={invalid}>
                <FieldLabel htmlFor="page-key">Page key (optional)</FieldLabel>
                <Input
                  id="page-key"
                  placeholder="first-post"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  maxLength={120}
                  aria-invalid={invalid}
                />
                <FieldDescription>
                  Stable thread id. A keyed thread follows the page when its URL changes; without one the thread stays
                  bound to the exact URL.
                </FieldDescription>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )
          }}
        />
        <form.Field
          name="title"
          children={(field) => {
            const invalid = !field.state.meta.isValid
            return (
              <Field data-invalid={invalid}>
                <FieldLabel htmlFor="page-title">Title (optional)</FieldLabel>
                <Input
                  id="page-title"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  maxLength={300}
                  aria-invalid={invalid}
                />
                <FieldDescription>Shown in the dashboard instead of the bare URL.</FieldDescription>
                <FieldError errors={field.state.meta.errors} />
              </Field>
            )
          }}
        />
      </FieldGroup>
    </FormDialog>
  )
}
