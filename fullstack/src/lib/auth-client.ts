import { createAuthClient } from 'better-auth/react'
import { adminClient } from 'better-auth/client/plugins'

export const { signIn, signOut, useSession } = createAuthClient({
  plugins: [adminClient()],
})