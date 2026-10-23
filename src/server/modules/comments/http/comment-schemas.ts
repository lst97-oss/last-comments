import { z } from 'zod'

import { commentBodyMarkdown } from '@/lib/comment-schema'

// Request schemas shared by the comment, vote and moderation routes. They
// live here (not in the route files) so the OpenAPI registry can document
// the exact schemas the API validates against.

export const pageUrlSchema = z
  .url()
  .max(2048)
  .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'URL must use HTTP or HTTPS')

export const pageKeySchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Page key must be a lowercase slug like this-is-test')

export const siteQuerySchema = z.strictObject({ site: z.string().min(1).max(100) })

export const pagesQuerySchema = z.strictObject({
  site: z.string().min(1).max(100),
  // 0 means "all time": the recent window is unbounded.
  recentDays: z.coerce.number().int().min(0).max(90).default(7).describe('Window in days; 0 means all time.'),
  preview: z.coerce.number().int().min(1).max(5).default(3),
})

export const takedownsQuerySchema = z.strictObject({
  site: z.string().min(1).max(100),
  // 0 means "all time", as on the pages query.
  recentDays: z.coerce.number().int().min(0).max(90).default(7),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
})

export const searchSchema = z
  .strictObject({
    site: z.string().min(1),
    url: pageUrlSchema.optional(),
    pageKey: pageKeySchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((value, ctx) => {
    if (value.url === undefined && value.pageKey === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Pass url or pageKey' })
    }
  })

export const commentBodySchema = z.strictObject({
  site: z.string().min(1).max(100),
  url: pageUrlSchema,
  pageKey: pageKeySchema.optional(),
  title: z.string().max(300).optional(),
  parentId: z.string().uuid().optional(),
  authorName: z.string().trim().min(1).max(80).optional(),
  bodyMarkdown: commentBodyMarkdown,
  verificationToken: z.string().max(4096).optional(),
})

export const editBodySchema = z.strictObject({
  site: z.string().min(1).max(100),
  bodyMarkdown: commentBodyMarkdown,
  editKey: z.string().min(1).max(128).optional(),
})

export const commentIdSchema = z.string().uuid()

export const voteBodySchema = z.strictObject({
  site: z.string().min(1).max(100),
  commentId: z.string().uuid(),
  value: z.union([z.literal(-1), z.literal(1)]),
})

export const voteSearchSchema = z.strictObject({
  site: z.string().min(1),
  commentId: z.string().uuid(),
})

// The domain helpers own URL/slug validation and their error codes, so this
// schema only bounds the payload.
export const pageBodySchema = z.strictObject({
  site: z.string().min(1).max(100),
  url: z.string().min(1).max(2048),
  pageKey: z.string().min(1).max(120).optional(),
  title: z.string().max(300).optional(),
})

export const listQuerySchema = z.strictObject({
  site: z.string().min(1).max(100).optional(),
  pageId: z.string().uuid().optional(),
  status: z.enum(['visible', 'hidden', 'deleted']).optional(),
  sort: z.enum(['newest', 'oldest']).default('newest'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export const statsQuerySchema = z.strictObject({
  site: z.string().min(1).max(100),
  days: z.enum(['7', '30', '90']).default('30'),
})

export const usersQuerySchema = z.strictObject({
  site: z.string().min(1).max(100),
  search: z.string().trim().max(120).optional(),
  filter: z.enum(['all', 'blocked']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export const userCommentsQuerySchema = z.strictObject({
  site: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

export const actionSchema = z.discriminatedUnion('target', [
  z.strictObject({
    site: z.string().min(1).max(100),
    target: z.literal('comment'),
    commentId: z.string().uuid(),
    action: z.enum(['hide', 'restore', 'delete', 'pin', 'unpin']),
  }),
  z.strictObject({
    site: z.string().min(1).max(100),
    target: z.literal('page'),
    pageId: z.string().uuid(),
    locked: z.boolean(),
  }),
  z.strictObject({
    site: z.string().min(1).max(100),
    target: z.literal('comment-create'),
    pageId: z.string().uuid(),
    parentId: z.string().uuid().optional(),
    anonymous: z.boolean().optional(),
    authorName: z.string().trim().min(1).max(80).optional(),
    bodyMarkdown: commentBodyMarkdown,
  }),
  z.strictObject({
    site: z.string().min(1).max(100),
    target: z.literal('comment-edit'),
    commentId: z.string().uuid(),
    bodyMarkdown: commentBodyMarkdown,
  }),
  z.strictObject({
    site: z.string().min(1).max(100),
    target: z.literal('vote'),
    commentId: z.string().uuid(),
    // null clears the viewer's vote, matching a second click on the same arrow.
    value: z.union([z.literal(-1), z.literal(1), z.null()]),
  }),
  z.strictObject({
    site: z.string().min(1).max(100),
    target: z.literal('user'),
    userId: z.string().min(1).max(255),
    blocked: z.boolean(),
  }),
])
