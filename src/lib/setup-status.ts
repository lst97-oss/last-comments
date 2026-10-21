import { createServerFn } from '@tanstack/react-start'

export const setupStatusServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { isInitialAdminSetupAvailable } = await import('@/server/modules/admin/infrastructure/admin-repository')
  return { setupAvailable: await isInitialAdminSetupAvailable() }
})
