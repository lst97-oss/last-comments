import { describe, expect, test } from 'bun:test'
import { getTableConfig } from 'drizzle-orm/pg-core'

import {
  account,
  comments,
  instanceAdmins,
  pages,
  pluginDeliveries,
  pluginEvents,
  session,
  siteMemberships,
  siteOrigins,
  sites,
  user,
  userBlocks,
  verification,
  verifiedUsers,
  votes,
} from '@/server/db/schema'

describe('business schema', () => {
  test('keeps Better Auth and comment-system tables in the business schema', () => {
    const tables = [
      user,
      session,
      account,
      verification,
      instanceAdmins,
      sites,
      siteOrigins,
      siteMemberships,
      pages,
      comments,
      votes,
      userBlocks,
      verifiedUsers,
      pluginEvents,
      pluginDeliveries,
    ]

    expect(tables.map((table) => getTableConfig(table).name)).toEqual([
      'user',
      'session',
      'account',
      'verification',
      'instance_admins',
      'sites',
      'site_origins',
      'site_memberships',
      'pages',
      'comments',
      'votes',
      'user_blocks',
      'verified_users',
      'plugin_events',
      'plugin_deliveries',
    ])
  })

  test('supports guests and keeps replies and moderation scoped to pages/sites', () => {
    const commentColumns = getTableConfig(comments).columns.map((column) => column.name)
    const pageColumns = getTableConfig(pages).columns.map((column) => column.name)
    const memberColumns = getTableConfig(siteMemberships).columns.map((column) => column.name)
    const originColumns = getTableConfig(siteOrigins).columns.map((column) => column.name)

    expect(commentColumns).toContain('user_id')
    expect(commentColumns).toContain('author_name')
    expect(commentColumns).toContain('parent_id')
    expect(commentColumns).toContain('page_id')
    expect(commentColumns).toContain('status')
    expect(pageColumns).toContain('canonical_url')
    expect(pageColumns).toContain('is_locked')
    expect(memberColumns).toContain('role')
    expect(originColumns).toContain('origin')
  })
})
