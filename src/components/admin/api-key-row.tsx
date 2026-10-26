'use client'

import { PermissionPicker } from '@/components/admin/permission-picker'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemTitle } from '@/components/ui/item'
import type { Site } from '@/lib/admin-sites'
import type { ApiKeyScope } from '@/lib/api-key-scopes'
import { type ApiKeyRecord, SITE_BOUND_SCOPES, scopesOfKey } from '@/lib/api-keys'

export function ApiKeyRow({
  apiKey,
  site,
  draft,
  canSave,
  showScopes = true,
  idPrefix,
  pending = false,
  onChangeScopes,
  onSave,
  onToggleEnabled,
  onRequestDelete,
}: {
  apiKey: ApiKeyRecord
  site?: Pick<Site, 'access' | 'gatewayOnly'>
  draft: ApiKeyScope[]
  canSave: boolean
  showScopes?: boolean
  idPrefix: string
  pending?: boolean
  onChangeScopes?: (scopes: ApiKeyScope[]) => void
  onSave?: () => void
  onToggleEnabled: () => void
  onRequestDelete: () => void
}) {
  const boundSite = apiKey.metadata?.site ?? null
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
      {showScopes && onChangeScopes && onSave && (
        <ItemFooter className="flex-col items-stretch border-border border-t pt-0">
          <Accordion>
            <AccordionItem value="permissions">
              <AccordionTrigger>
                <span>
                  Permissions{' '}
                  <span className="font-normal text-muted-foreground">
                    ({grantedScopes.length}/{SITE_BOUND_SCOPES.length})
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="[&_p:not(:last-child)]:mb-0">
                <PermissionPicker idPrefix={idPrefix} scopes={draft} site={site} onChange={onChangeScopes} />
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
