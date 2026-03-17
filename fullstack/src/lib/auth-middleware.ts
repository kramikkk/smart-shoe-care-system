import { NextRequest, NextResponse } from 'next/server'
import { auth } from './auth'
import { headers } from 'next/headers'

/**
 * Authentication middleware for API routes
 * Verifies that the request has a valid session
 */
// `request` is kept for API-route handler signature consistency even though
// Better Auth reads session cookies via Next.js `headers()` internally.
export async function requireAuth(_request: NextRequest) {
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
 * Admin-only authentication middleware for API routes
 * Verifies that the request has a valid session with admin role
 */
export async function requireAdminAuth(request: NextRequest) {
  const result = await requireAuth(request)
  if (result instanceof NextResponse) return result // 401 from requireAuth

  if (result.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return result
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
