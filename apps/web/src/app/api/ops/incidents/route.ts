import { NextResponse } from 'next/server';
import { loadOpsIncidentsForSession } from '@/lib/ops-incidents';

export const dynamic = 'force-dynamic';

/**
 * Tenant-scoped incidents API for /ops/incidents.
 * Organization is resolved only from Clerk session + Firestore membership.
 * Query params such as organizationId are intentionally ignored.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  // Explicitly ignore client tenant hints
  if (url.searchParams.has('organizationId')) {
    // Do not use the value — continue with session context only
  }

  const result = await loadOpsIncidentsForSession();
  if (!result.ok) {
    const status =
      result.code === 'unauthenticated'
        ? 401
        : result.code === 'permission_denied' || result.code === 'no_membership'
          ? 403
          : result.code === 'no_organization'
            ? 400
            : result.code === 'clerk_unconfigured'
              ? 503
              : 503;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
