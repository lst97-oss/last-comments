import { z } from 'zod'

import { definePluginConfig, loadPluginConfig } from '@/server/plugins/plugin-config'

// Comment policy tuning (not a plugin itself — the guest edit window).
// Signed-in authors edit any time; guests get a bearer edit key at create
// time usable within `anonEditWindowMinutes` (0 = unlimited).

export const commentPolicyFileSchema = z.strictObject({
  anonEditWindowMinutes: z.number().int().min(0).default(10),
})
export type CommentPolicyFileConfig = z.infer<typeof commentPolicyFileSchema>

export const commentPolicyConfigDef = definePluginConfig({
  id: 'comment-policy',
  fileSchema: commentPolicyFileSchema,
  defaults: { anonEditWindowMinutes: 10 } satisfies CommentPolicyFileConfig,
  resolve: (file) => ({ anonWindowMinutes: file.anonEditWindowMinutes }),
})

export const commentPolicyConfig: CommentPolicyFileConfig = commentPolicyConfigDef.defaults

export function getCommentEditSettings(file?: unknown) {
  return loadPluginConfig(commentPolicyConfigDef, { file: file ?? commentPolicyConfig })
}
