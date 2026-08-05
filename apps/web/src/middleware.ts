import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/gallery(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/unauthorized',
])

const isOrgSelectionRoute = createRouteMatcher(['/select-organization(.*)'])
const isPlatformRoute = createRouteMatcher(['/platform(.*)'])
const isOpsRoute = createRouteMatcher(['/ops(.*)'])

function clerkConfigured(): boolean {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''
  const sk = process.env.CLERK_SECRET_KEY ?? ''
  return (
    pk.startsWith('pk_') &&
    sk.startsWith('sk_') &&
    !pk.includes('your_key') &&
    !sk.includes('your_key')
  )
}

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

  if (!userId) {
    // Avoid redirect loops: never bounce auth pages onto themselves.
    if (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) {
      return NextResponse.next()
    }
    const signInUrl = new URL('/sign-in', req.url)
    signInUrl.searchParams.set('redirect_url', pathname)
    return NextResponse.redirect(signInUrl)
  }

  if (isPlatformRoute(req)) {
    const metadata = sessionClaims?.metadata as { platformAdmin?: boolean } | undefined
    if (metadata?.platformAdmin !== true) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }
  }

  if (isOpsRoute(req) && !orgId) {
    return NextResponse.redirect(new URL('/select-organization', req.url))
  }

  return NextResponse.next()
})

/** Pass-through until Clerk keys exist — keeps Phase 1 shells usable. */
function passthroughMiddleware(_req: NextRequest) {
  return NextResponse.next()
}

export default clerkConfigured() ? clerkAuthMiddleware : passthroughMiddleware

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
