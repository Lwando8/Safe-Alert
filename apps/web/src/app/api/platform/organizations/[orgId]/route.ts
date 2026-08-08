import { NextResponse } from 'next/server';
import {
  getPlatformOrganization,
  linkPlatformOrganizationClerk,
  updatePlatformOrganization,
} from '@/lib/platform-organizations';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ orgId: string }> };

function statusFor(code: string): number {
  switch (code) {
    case 'unauthenticated':
      return 401;
    case 'permission_denied':
      return 403;
    case 'not_found':
      return 404;
    case 'invalid':
      return 400;
    case 'failed_precondition':
      return 409;
    default:
      return 503;
  }
}

export async function GET(_request: Request, { params }: Params) {
  const { orgId } = await params;
  const result = await getPlatformOrganization(orgId);
  if (!result.ok) {
    return NextResponse.json(result, { status: statusFor(result.code) });
  }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PATCH(request: Request, { params }: Params) {
  const { orgId } = await params;
  let body: {
    tenantProfile?: string;
    modules?: Record<string, boolean>;
    action?: string;
    clerkOrganizationId?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: 'invalid', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (body.action === 'link_clerk') {
    const linked = await linkPlatformOrganizationClerk({
      organizationId: orgId,
      clerkOrganizationId: String(body.clerkOrganizationId || ''),
    });
    if (!linked.ok) {
      return NextResponse.json(linked, { status: statusFor(linked.code) });
    }
    const refreshed = await getPlatformOrganization(orgId);
    return NextResponse.json(refreshed, { headers: { 'Cache-Control': 'no-store' } });
  }

  const result = await updatePlatformOrganization({
    organizationId: orgId,
    tenantProfile: body.tenantProfile,
    modules: body.modules,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: statusFor(result.code) });
  }

  const refreshed = await getPlatformOrganization(orgId);
  return NextResponse.json(refreshed, { headers: { 'Cache-Control': 'no-store' } });
}
