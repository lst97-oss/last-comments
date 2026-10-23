import { describe, expect, test } from 'bun:test'

import { toBunSqlUrl } from '@/server/db/business-sql'

describe('toBunSqlUrl', () => {
  test('rewrites no-verify to the mode Bun SQL accepts', () => {
    expect(toBunSqlUrl('postgres://u:p@db:5432/app?sslmode=no-verify')).toBe(
      'postgres://u:p@db:5432/app?sslmode=require',
    )
    expect(toBunSqlUrl('postgres://u:p@db/app?sslmode=NO-VERIFY&application_name=x')).toBe(
      'postgres://u:p@db/app?sslmode=require&application_name=x',
    )
  })

  test('leaves every other mode and a plain URL untouched', () => {
    expect(toBunSqlUrl('postgres://u:p@db/app?sslmode=verify-full')).toBe('postgres://u:p@db/app?sslmode=verify-full')
    expect(toBunSqlUrl('postgres://u:p@db/app?sslmode=require')).toBe('postgres://u:p@db/app?sslmode=require')
    expect(toBunSqlUrl('postgres://u:p@db/app')).toBe('postgres://u:p@db/app')
  })
})
