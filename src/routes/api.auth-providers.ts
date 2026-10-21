import { createFileRoute } from '@tanstack/react-router'

import { getAuthSelection } from '@/server/auth/provider-config'
import { withContext } from '@/server/http/with-context'

// Public, unauthenticated: the sign-in UI needs to know which providers to
// render before anyone is signed in. Provider names only, no secrets.
export const Route = createFileRoute('/api/auth-providers')({
  server: {
    handlers: {
      GET: ({ request }) =>
        withContext(async () => {
          const { providers } = getAuthSelection()
          return { providers }
        })({ request }),
    },
  },
})
