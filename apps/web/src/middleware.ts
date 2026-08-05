import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher(['/', '/gallery(.*)'])
const isPlatformRoute = createRouteMatcher(['/platform(.*)'])
const isOpsRoute = createRouteMatcher(['/ops(.*)'])

export default clerkMiddleware(async (auth, req) => {
  const { userId, orgId, orgRole, has } = await auth()

  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }

  // Require authentication for all other routes
  if (!userId) {
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', req.url)
    return NextResponse.redirect(signInUrl)
  }

  // Platform routes require platform admin role
  if (isPlatformRoute(req)) {
    // Check for platform admin via session claims
    const session = await auth()
    const isPlatformAdmin = session.sessionClaims?.metadata?.platformAdmin === true
    
    if (!isPlatformAdmin) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }
  }

  // Ops routes require organization membership
  if (isOpsRoute(req)) {
    if (!orgId) {
      // Redirect to organization selection if no active org
      return NextResponse.redirect(new URL('/select-organization', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
