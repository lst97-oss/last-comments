import config from '@payload-config'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { getPayload } from 'payload'
import type { Payload } from 'payload'

// Live integration suite: boots Payload against DATABASE_URL (the demo
// container) and exercises the users collection end-to-end — create, login,
// failed login, find. Local-API create/find/delete bypass the collection's
// default-deny access via overrideAccess; login stays public, like the real
// /api/users/login endpoint. Requires env: bun test tests/users.integration.test.ts
let payload: Payload

const TEST_EMAIL = 'integration-test@example.com'
const TEST_PASSWORD = 'integration-test-password-123'

async function cleanupTestUser() {
  await payload.delete({
    collection: 'users',
    overrideAccess: true,
    where: { email: { equals: TEST_EMAIL } },
  })
}

beforeAll(async () => {
  payload = await getPayload({ config })
  await cleanupTestUser()
})

afterAll(async () => {
  await cleanupTestUser()
  await payload.db?.destroy?.()
})

describe('users collection', () => {
  test('creates a user with auth credentials', async () => {
    const user = await payload.create({
      collection: 'users',
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
      overrideAccess: true,
    })
    expect(user.email).toBe(TEST_EMAIL)
    expect(user.id).toBeDefined()
  })

  test('authenticates with email and password', async () => {
    const result = await payload.login({
      collection: 'users',
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    })
    expect(result.token).toBeDefined()
    expect(result.user?.email).toBe(TEST_EMAIL)
  })

  test('rejects wrong password', async () => {
    await expect(
      payload.login({
        collection: 'users',
        data: { email: TEST_EMAIL, password: 'wrong-password' },
      }),
    ).rejects.toThrow()
  })

  test('finds the user by email', async () => {
    const { docs, totalDocs } = await payload.find({
      collection: 'users',
      overrideAccess: true,
      where: { email: { equals: TEST_EMAIL } },
    })
    expect(totalDocs).toBe(1)
    expect(docs[0]?.email).toBe(TEST_EMAIL)
  })
})
