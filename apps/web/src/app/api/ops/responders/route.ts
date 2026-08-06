import { NextResponse } from 'next/server';
import { loadOpsRespondersForSession } from '@/lib/ops-responders';

export const dynamic = 'force-dynamic';

/**
 * Tenant-scoped responders API for /ops/responders.
 * Query params such as organizationId are intentionally ignored.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.has('organizationId')) {
    // Intentionally ignored — session membership is sole tenant authority
  }

  const result = await loadOpsRespondersForSession();
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
