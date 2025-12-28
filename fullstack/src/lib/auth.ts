import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import prisma from '@/lib/prisma'
import { nextCookies } from 'better-auth/next-js'

// Get trusted origins from environment variable or use defaults
const getTrustedOrigins = () => {
  const envOrigins = process.env.TRUSTED_ORIGINS
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim())
  }
  // Default to localhost for development
  return ['http://localhost:3000']
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: getTrustedOrigins(),
  plugins: [nextCookies()],
})