import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'
import { isClerkConfigured, resolveProtectedRouteRedirect } from '@/lib/auth-guards'

const isPublicRoute = createRouteMatcher([
  '/',
  '/gallery(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/unauthorized',
])

const isOrgSelectionRoute = createRouteMatcher(['/select-organization(.*)'])

const clerkAuthMiddleware = clerkMiddleware(async (auth, req) => {
  const { userId, orgId, sessionClaims } = await auth()
  const pathname = req.nextUrl.pathname

  if (isPublicRoute(req)) {
    return NextResponse.next()
  }

  // Authenticated users may open org selection without an active org.
  if (isOrgSelectionRoute(req)) {
    if (!userId) {
      const signInUrl = new URL('/sign-in', req.url)
      signInUrl.searchParams.set('redirect_url', '/select-organization')
      return NextResponse.redirect(signInUrl)
    }
    return NextResponse.next()
  }

  const redirect = resolveProtectedRouteRedirect(pathname, {
    userId,
    orgId,
    sessionClaims: sessionClaims as { metadata?: { platformAdmin?: boolean } } | null,
  })

  if (redirect === '/sign-in') {
    if (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) {
      return NextResponse.next()
    }
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', pathname)
    return NextResponse.redirect(signInUrl)
  }

  if (redirect === '/unauthorized') {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  if (redirect === '/select-organization') {
    return NextResponse.redirect(new URL('/select-organization', req.url))
  }

  return NextResponse.next()
})

/** Pass-through until Clerk keys exist — keeps Phase 1 shells usable. */
function passthroughMiddleware(_req: NextRequest) {
  return NextResponse.next()
}

export default isClerkConfigured() ? clerkAuthMiddleware : passthroughMiddleware

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
