'use client'

import type { DeepKeys, DeepValue } from '@tanstack/form-core'

import { type AdminFormApi } from '@/components/admin/form-dialog'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function AccountTextField<TData extends Record<string, unknown>, TName extends DeepKeys<TData>>({
  form,
  name,
  id,
  label,
  type = 'text',
  autoComplete,
  maxLength,
  minLength,
  placeholder,
  inputMode,
  required = true,
  description,
  validators,
}: {
  form: AdminFormApi<TData>
  name: TName
  id: string
  label: string
  type?: string
  autoComplete?: string
  maxLength?: number
  minLength?: number
  placeholder?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  // Optional fields must not carry the native `required`, or the browser blocks Save.
  required?: boolean
  description?: string
  validators?: Record<string, unknown>
}) {
  return (
    <form.Field
      name={name}
      validators={validators as never}
      children={(field) => {
        const invalid = !field.state.meta.isValid
        return (
          <Field data-invalid={invalid}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Input
              id={id}
              type={type}
              value={field.state.value as string}
              onChange={(event) => field.handleChange(event.target.value as DeepValue<TData, TName>)}
              onBlur={field.handleBlur}
              autoComplete={autoComplete}
              maxLength={maxLength}
              minLength={minLength}
              placeholder={placeholder}
              inputMode={inputMode}
              aria-invalid={invalid}
              required={required}
            />
            {description ? <FieldDescription>{description}</FieldDescription> : null}
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )
      }}
    />
  )
}
