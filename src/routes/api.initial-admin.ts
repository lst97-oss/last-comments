import { createFileRoute } from '@tanstack/react-router'
import { initialAdminSchema } from '@/lib/site-schema'
import { getBusinessSetupAuth } from '@/server/auth/business-auth'
import { HttpError } from '@/server/http/errors'
import { ok } from '@/server/http/response'
import { assertSameOrigin } from '@/server/http/route-guards'
import { parseJsonBody } from '@/server/http/validation'
import { withContext } from '@/server/http/with-context'
import {
  createInitialAdmin,
  isInitialAdminSetupAvailable,
} from '@/server/modules/admin/infrastructure/admin-repository'

export const Route = createFileRoute('/api/initial-admin')({
  server: {
    handlers: {
      GET: ({ request }) => withContext(async () => ({ available: await isInitialAdminSetupAvailable() }))({ request }),
      POST: ({ request }) =>
        withContext(async () => {
          assertSameOrigin(request, 'Setup requests must use the application origin')
          const body = await parseJsonBody(request, initialAdminSchema)
          const auth = getBusinessSetupAuth()
          const result = await createInitialAdmin(async () => {
            const signup = await auth.api.signUpEmail({ body, returnHeaders: true })
            if (!('user' in signup.response)) {
              throw new HttpError(400, 'ADMIN_SIGNUP_FAILED', 'Could not create the initial admin account')
            }
            return { ...signup, userId: signup.response.user.id }
          })
          const response = ok({ user: result.response.user })
          for (const cookie of result.headers.getSetCookie()) response.headers.append('set-cookie', cookie)
          return response
        })({ request }),
    },
  },
})
