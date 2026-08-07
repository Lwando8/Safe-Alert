import { NextResponse } from 'next/server';
import { loadOpsAnalyticsForSession } from '@/lib/ops-analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.has('organizationId')) {
    // ignored
  }
  const result = await loadOpsAnalyticsForSession();
  if (!result.ok) {
    const status =
      result.code === 'unauthenticated'
        ? 401
        : result.code === 'permission_denied' || result.code === 'no_membership'
          ? 403
          : 503;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
