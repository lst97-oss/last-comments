import { describe, expect, test } from 'bun:test'

import { initialAdminSchema } from '@/lib/site-schema'
import { adminSiteSchema } from '@/server/modules/admin/http/admin-schemas'

describe('admin setup schemas', () => {
  test('requires a strong initial admin password', () => {
    expect(initialAdminSchema.safeParse({ name: 'Admin', email: 'admin@example.com', password: 'short' }).success).toBe(
      false,
    )
  })

  test('accepts only site origins without paths', () => {
    const site = { name: 'Docs', origin: 'https://docs.example.com' }
    expect(adminSiteSchema.safeParse(site).success).toBe(true)
    expect(adminSiteSchema.parse({ ...site, origin: 'https://docs.example.com/' }).origin).toBe(
      'https://docs.example.com',
    )
    expect(adminSiteSchema.safeParse({ ...site, origin: 'https://docs.example.com/path' }).success).toBe(false)
  })
})
