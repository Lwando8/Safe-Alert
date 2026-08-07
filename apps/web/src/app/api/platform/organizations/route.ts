import { NextResponse } from 'next/server';
import { listPlatformOrganizations } from '@/lib/platform-organizations';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await listPlatformOrganizations();
  if (!result.ok) {
    const status =
      result.code === 'unauthenticated'
        ? 401
        : result.code === 'permission_denied'
          ? 403
          : 503;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
