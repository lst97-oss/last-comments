'use client'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import type { Site } from '@/lib/admin-sites'
import type { ApiKeyScope } from '@/lib/api-key-scopes'
import {
  API_KEY_FEATURES,
  SCOPE_DESCRIPTIONS,
  SCOPE_GROUPS,
  SCOPE_LABELS,
  SITE_BOUND_SCOPES,
  toggleScopeIn,
} from '@/lib/api-keys'

type SiteSettings = Pick<Site, 'access' | 'gatewayOnly'>

type ChecklistItem = {
  id: string
  label: string
  code: string
  description: string
  checked: boolean
  onToggle: () => void
}

type ChecklistGroup = { id: string; label: string; items: ChecklistItem[] }

// One list of permissions. Each item uses its feature's title and description. The comment permissions are
// ticked to match the chosen site, which reflects how its host connects, so the form does not ask about it.
export function PermissionPicker({
  idPrefix,
  scopes,
  site,
  onChange,
}: {
  idPrefix: string
  scopes: ApiKeyScope[]
  site?: SiteSettings
  onChange: (next: ApiKeyScope[]) => void
}) {
  const granted = SITE_BOUND_SCOPES.filter((scope) => scopes.includes(scope))

  return (
    <div className="flex flex-col gap-3">
      {site && (
        <p className="text-sm text-muted-foreground">
          Comment permissions are ticked to match this site&apos;s settings. Tick the page permissions your server
          needs.
        </p>
      )}
      <Checklist
        idPrefix={`${idPrefix}-scope`}
        groups={scopeGroups(scopes, (scope) => onChange(toggleScopeIn(scopes, scope)))}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {granted.length === 0 ? (
          <span className="text-sm text-muted-foreground">No permissions selected</span>
        ) : (
          <>
            <span className="text-sm text-muted-foreground">Grants</span>
            {granted.map((scope) => (
              <Badge key={scope} variant="secondary" className="font-mono">
                {scope}
              </Badge>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// Each site-bound scope is granted by exactly one feature, so the feature's title and description name it.
function scopeGroups(scopes: readonly ApiKeyScope[], onToggle: (scope: ApiKeyScope) => void): ChecklistGroup[] {
  return SCOPE_GROUPS.map((group) => ({
    id: group.resource,
    label: group.label,
    items: group.scopes.map((scope) => {
      const feature = API_KEY_FEATURES.find((item) => item.scopes.includes(scope))
      return {
        id: scope,
        label: feature?.label ?? SCOPE_LABELS[scope],
        code: scope,
        description: feature?.description ?? SCOPE_DESCRIPTIONS[scope],
        checked: scopes.includes(scope),
        onToggle: () => onToggle(scope),
      }
    }),
  }))
}

// Comment and page permissions each sit in their own section, open by default.
function Checklist({ idPrefix, groups }: { idPrefix: string; groups: ChecklistGroup[] }) {
  return (
    <Accordion multiple keepMounted defaultValue={groups.map((group) => group.id)}>
      {groups.map((group) => (
        <AccordionItem key={group.id} value={group.id}>
          <AccordionTrigger>{group.label}</AccordionTrigger>
          <AccordionContent>
            <FieldGroup data-slot="checkbox-group">
              {group.items.map((item) => {
                const id = `${idPrefix}-${item.id}`
                return (
                  <Field key={item.id} orientation="horizontal">
                    <Checkbox id={id} checked={item.checked} onCheckedChange={item.onToggle} />
                    <FieldContent>
                      <FieldLabel htmlFor={id}>
                        {item.label} <code className="text-xs font-normal text-muted-foreground">{item.code}</code>
                      </FieldLabel>
                      <FieldDescription>{item.description}</FieldDescription>
                    </FieldContent>
                  </Field>
                )
              })}
            </FieldGroup>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
