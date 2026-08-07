import { NextResponse } from 'next/server';
import { loadOpsRequestsForSession } from '@/lib/ops-requests';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.has('organizationId')) {
    // Intentionally ignored — session membership is authoritative
  }
  const result = await loadOpsRequestsForSession();
  if (!result.ok) {
    const status =
      result.code === 'unauthenticated'
        ? 401
        : result.code === 'permission_denied' || result.code === 'no_membership'
          ? 403
          : result.code === 'no_organization'
            ? 400
            : 503;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
