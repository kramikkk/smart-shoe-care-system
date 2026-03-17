import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't require authentication
  const publicRoutes = [
    '/kiosk',
    '/client/login',
    '/api/auth',
    '/api/transaction/create',
    '/api/pricing',
    '/api/duration',
    '/api/device/register',      // ESP32 registration
    '/api/device/status',         // ESP32 status update
    '/api/payment',
  ]

  // Check for device-specific routes that should be public (for kiosk/ESP32)
  const isPublicDeviceRoute = pathname.match(/^\/api\/device\/[^/]+\/(status|classify|pair)$/)

  // Check if the current path is public
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route)) || isPublicDeviceRoute

  if (isPublicRoute) {
    // For /client/login, redirect already-authenticated users by role
    if (pathname === '/client/login') {
      const session = await auth.api.getSession({ headers: request.headers })
      if (session) {
        if (session.user.role === 'admin') {
          return NextResponse.redirect(new URL('/admin/dashboard', request.url))
        }
        return NextResponse.redirect(new URL('/client/dashboard', request.url))
      }
    }
    return NextResponse.next()
  }

  // Admin routes — require admin role
  if (pathname.startsWith('/admin')) {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return NextResponse.redirect(new URL('/client/login', request.url))
    }
    if (session.user.role !== 'admin') {
      return NextResponse.redirect(new URL('/client/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // Client dashboard — require auth; redirect admins to their dashboard
  if (pathname.startsWith('/client/dashboard')) {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      const loginUrl = new URL('/client/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }
    if (session.user.role === 'admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // Other /client routes — require auth
  if (pathname.startsWith('/client')) {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      const loginUrl = new URL('/client/login', request.url)
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
