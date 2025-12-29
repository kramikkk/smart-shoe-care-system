import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't require authentication
  const publicRoutes = [
    '/user',
    '/admin/login',
    '/api/auth',
    '/api/transaction/create',
    '/api/pricing',
    '/api/device/register',      // ESP32 registration
    '/api/payment',
  ]

  // Check for device-specific routes that should be public (for kiosk/ESP32)
  const isPublicDeviceRoute = pathname.match(/^\/api\/device\/[^/]+\/(status|pair)$/)

  // Check if the current path is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route)) || isPublicDeviceRoute

  if (isPublicRoute) {
    return NextResponse.next()
  }

  // Check if path requires admin authentication
  const isAdminRoute = pathname.startsWith('/admin')

  if (isAdminRoute) {
    // Check for session
    const session = await auth.api.getSession({
      headers: request.headers
    })

    if (!session) {
      // Redirect to login if not authenticated
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$).*)',
  ],
}
