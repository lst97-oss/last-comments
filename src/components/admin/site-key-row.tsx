'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel, FieldSet } from '@/components/ui/field'
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemTitle } from '@/components/ui/item'
import type { ApiKeyScope } from '@/lib/api-key-scopes'
import { type PluginKey, SCOPE_DESCRIPTIONS, SCOPE_LABELS, SITE_KEY_SCOPES, scopesOfKey } from '@/lib/site-keys'

export function SiteKeyRow({
  apiKey,
  draft,
  canSave,
  showScopes = true,
  idPrefix,
  pending = false,
  onToggleScope,
  onSave,
  onToggleEnabled,
  onRequestDelete,
}: {
  apiKey: PluginKey
  draft: ApiKeyScope[]
  canSave: boolean
  showScopes?: boolean
  idPrefix: string
  pending?: boolean
  onToggleScope?: (scope: ApiKeyScope) => void
  onSave?: () => void
  onToggleEnabled: () => void
  onRequestDelete: () => void
}) {
  const boundSite = apiKey.metadata?.siteKey ?? null
  const grantedScopes = scopesOfKey(apiKey)
  const details = [`created ${new Date(apiKey.createdAt).toLocaleDateString()}`]
  if (apiKey.expiresAt) details.push(`expires ${new Date(apiKey.expiresAt).toLocaleDateString()}`)
  details.push(grantedScopes.join(', ') || 'no permissions')

  return (
    <Item variant="outline">
      <ItemContent>
        <ItemTitle>
          {apiKey.name ?? '(unnamed)'}
          {boundSite && <Badge variant="secondary">site: {boundSite}</Badge>}
          {!apiKey.enabled && (
            <Badge variant="outline" className="text-muted-foreground">
              Disabled
            </Badge>
          )}
        </ItemTitle>
        <ItemDescription>
          <span className="font-mono">{apiKey.start ?? apiKey.prefix ?? apiKey.id}</span> · {details.join(' · ')}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onToggleEnabled}>
          {apiKey.enabled ? 'Disable' : 'Enable'}
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={onRequestDelete}>
          Delete
        </Button>
      </ItemActions>
      {showScopes && onToggleScope && onSave && (
        <ItemFooter className="flex-col items-stretch border-border border-t pt-0">
          <Accordion>
            <AccordionItem value="permissions">
              <AccordionTrigger>
                <span>
                  Permissions{' '}
                  <span className="font-normal text-muted-foreground">
                    ({grantedScopes.length}/{SITE_KEY_SCOPES.length})
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="[&_p:not(:last-child)]:mb-0">
                <FieldSet>
                  <FieldGroup data-slot="checkbox-group">
                    {SITE_KEY_SCOPES.map((scope) => {
                      const id = `${idPrefix}-scope-${scope}`
                      return (
                        <Field key={scope} orientation="horizontal">
                          <Checkbox
                            id={id}
                            checked={draft.includes(scope)}
                            onCheckedChange={() => onToggleScope(scope)}
                          />
                          <FieldContent>
                            <FieldLabel htmlFor={id}>{SCOPE_LABELS[scope]}</FieldLabel>
                            <FieldDescription>{SCOPE_DESCRIPTIONS[scope]}</FieldDescription>
                          </FieldContent>
                        </Field>
                      )
                    })}
                  </FieldGroup>
                </FieldSet>
                <div className="flex justify-end pt-4">
                  <Button type="button" size="sm" variant="secondary" disabled={!canSave || pending} onClick={onSave}>
                    Save permissions
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </ItemFooter>
      )}
    </Item>
  )
}
