const EDIT_KEY_BYTES = 32

export function createEditKey(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(EDIT_KEY_BYTES))).toString('base64url')
}

export async function hashEditKey(editKey: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(editKey))
  return Buffer.from(digest).toString('hex')
}

export async function matchesEditKey(editKey: string, storedHash: string): Promise<boolean> {
  const presented = Buffer.from(await hashEditKey(editKey), 'hex')
  const stored = Buffer.from(storedHash, 'hex')
  return presented.length === stored.length && crypto.timingSafeEqual(presented, stored)
}

// Never serialize the stored hash: only the plaintext key returned at create
// time may reach the client.
export function withoutEditKeyHash<T extends { editKeyHash: string | null }>(row: T): Omit<T, 'editKeyHash'> {
  const { editKeyHash: _editKeyHash, ...rest } = row
  return rest
}
