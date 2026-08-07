import { NextResponse } from 'next/server';
import {
  getPlatformOrganization,
  updatePlatformOrganization,
} from '@/lib/platform-organizations';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { orgId } = await params;
  const result = await getPlatformOrganization(orgId);
  if (!result.ok) {
    const status =
      result.code === 'unauthenticated'
        ? 401
        : result.code === 'permission_denied'
          ? 403
          : result.code === 'not_found'
            ? 404
            : 503;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: Request, { params }: Params) {
  const { orgId } = await params;
  let body: { tenantProfile?: string; modules?: Record<string, boolean> } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: 'invalid', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const result = await updatePlatformOrganization({
    organizationId: orgId,
    tenantProfile: body.tenantProfile,
    modules: body.modules,
  });

  if (!result.ok) {
    const status =
      result.code === 'unauthenticated'
        ? 401
        : result.code === 'permission_denied'
          ? 403
          : result.code === 'not_found'
            ? 404
            : result.code === 'invalid'
              ? 400
              : 503;
    return NextResponse.json(result, { status });
  }

  const refreshed = await getPlatformOrganization(orgId);
  return NextResponse.json(refreshed, { headers: { 'Cache-Control': 'no-store' } });
}
