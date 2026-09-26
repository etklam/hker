import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const legacy = ['/bills', '/spaces', '/me', '/marketplace', '/tools', '/invite', '/register', '/admin/users', '/api/me', '/api/admin/stats', '/api/admin/collections', '/api/monthly-bills', '/api/spaces', '/api/collections', '/api/links', '/api/invites', '/api/marketplace', '/api/subscriptions', '/api/featured', '/api/auth/register', '/api/admin/users', '/api/admin/marketplace']
  if (legacy.some(path => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`))) {
    return new NextResponse('This legacy feature is no longer available.', { status: 410 })
  }
  const response = NextResponse.next()
  
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-DNS-Prefetch-Control', 'on')

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
    )
  } else {
    response.headers.set(
      'Content-Security-Policy-Report-Only',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'",
    )
  }

  // Protect admin API routes at the edge (admin page-level is handled client-side + API withAdmin)
  const pathname = request.nextUrl.pathname
  if (pathname.startsWith('/api/admin')) {
    // The actual auth check is done in withAdmin handler, but we add extra headers
    response.headers.set('Cache-Control', 'no-store')
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
