import { NextRequest, NextResponse } from 'next/server'
import { auth } from './auth'
import { headers } from 'next/headers'

/**
 * Authentication middleware for API routes
 * Verifies that the request has a valid session
 */
export async function requireAuth(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized - Authentication required' },
      { status: 401 }
    )
  }

  return { session, user: session.user }
}

/**
 * Optional auth - returns session if available, but doesn't require it
 */
export async function optionalAuth() {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })
    return session
  } catch {
    return null
  }
}
