import { eq, inArray } from 'drizzle-orm'

import { getBusinessSetupAuth } from '@/server/auth/business-auth'
import { getBusinessDb } from '@/server/db/business-sql'
import { apikey, instanceAdmins, sites, user } from '@/server/db/schema'
import { createComment } from '@/server/modules/comments/application/create-comment'
import { persistComment, prepareCommentCreation } from '@/server/modules/comments/infrastructure/comment-repository'

// Shared integration-test harness (not a *.test.ts file, so `bun test` skips
// it). Callers push their fixtures into these arrays and await
// cleanupTestData() in afterAll — no per-file teardown drift.

// Resolved per call: payload-shutdown's drainAll() closes the shared pool.
const db = () => getBusinessDb()
export const siteKeys: string[] = []
export const userIds: string[] = []
export const keyIds: string[] = []

export async function cleanupTestData(): Promise<void> {
  if (keyIds.length > 0) await db().delete(apikey).where(inArray(apikey.id, keyIds))
  for (const key of siteKeys) await db().delete(sites).where(eq(sites.key, key))
  if (userIds.length > 0) await db().delete(user).where(inArray(user.id, userIds))
}

export type InstanceAdminLoan = { previousUserId: string | null; lentUserId: string | null }

// Lend the singleton admin slot to a test user, then restore the previous
// holder or remove the row when the suite started with a fresh database.
export async function lendInstanceAdmin(userId: string): Promise<InstanceAdminLoan> {
  const [current] = await db().select({ userId: instanceAdmins.userId }).from(instanceAdmins).limit(1)
  if (current?.userId) {
    await db().update(instanceAdmins).set({ userId })
    return { previousUserId: current.userId, lentUserId: null }
  }
  await db().insert(instanceAdmins).values({ userId })
  return { previousUserId: null, lentUserId: userId }
}

export async function returnInstanceAdmin(loan: InstanceAdminLoan): Promise<void> {
  if (loan.previousUserId) {
    await db().update(instanceAdmins).set({ userId: loan.previousUserId })
  } else if (loan.lentUserId) {
    await db().delete(instanceAdmins).where(eq(instanceAdmins.userId, loan.lentUserId))
  }
}

type Handler = (request: Request) => Promise<Response>

type RouteContext = { request: Request; params?: Record<string, string> }

type RouteHandlers = Record<string, (ctx: RouteContext) => Promise<Response>>

function handlersOf(route: unknown): RouteHandlers {
  return (route as { options: { server: { handlers: RouteHandlers } } }).options.server.handlers
}

// TanStack Start route handlers take { request } (plus params) — tests call
// them directly, so unwrap the context here instead of per test file.
export function handlerOf(route: unknown, name: string): Handler {
  const handler = handlersOf(route)[name]!
  return (request) => handler({ request })
}

export function handlerOfParams(
  route: unknown,
  name: string,
): (request: Request, params: Record<string, string>) => Promise<Response> {
  const handler = handlersOf(route)[name]!
  return (request, params) => handler({ request, params })
}

export function jsonRequest(url: string, method: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export async function createOwner(name = 'Test owner'): Promise<string> {
  const id = crypto.randomUUID()
  userIds.push(id)
  await db()
    .insert(user)
    .values({ id, name, email: `${id}@test.invalid` })
  return id
}

// A real session cookie for a fresh user, minted through better-auth's own
// password sign-up on the setup instance (the only one that allows sign-up).
// It shares the database and secret, so the cookie authenticates the normal
// instance too — the cheapest way to test session-gated routes end to end.
export async function createSignedInUser(): Promise<{ userId: string; cookie: string }> {
  const email = `${crypto.randomUUID()}@test.invalid`
  const signup = await getBusinessSetupAuth().api.signUpEmail({
    body: { name: 'Session user', email, password: 'test-only-password-123' },
    returnHeaders: true,
  })
  if (!('user' in signup.response)) throw new Error('Could not create the session test user')
  const userId = signup.response.user.id
  userIds.push(userId)
  const cookie = signup.headers
    .getSetCookie()
    .map((header) => header.split(';', 1)[0]!)
    .join('; ')
  return { userId, cookie }
}

// createComment with the real ports, minus human verification.
export function createTestComment(data: Parameters<typeof createComment>[0]) {
  return createComment(data, {
    prepare: prepareCommentCreation,
    validate: async () => {},
    persist: persistComment,
  })
}
