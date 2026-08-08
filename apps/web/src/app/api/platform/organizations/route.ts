import { NextResponse } from 'next/server';
import {
  listPlatformOrganizations,
  provisionPlatformOrganization,
} from '@/lib/platform-organizations';

export const dynamic = 'force-dynamic';

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

export async function GET() {
  const result = await listPlatformOrganizations();
  if (!result.ok) {
    return NextResponse.json(result, { status: statusFor(result.code) });
  }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  let body: {
    name?: string;
    slug?: string;
    tenantProfile?: string;
    mode?: 'lab' | 'live';
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

  const result = await provisionPlatformOrganization({
    name: String(body.name || ''),
    slug: body.slug,
    tenantProfile: body.tenantProfile,
    mode: body.mode,
    clerkOrganizationId: body.clerkOrganizationId,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: statusFor(result.code) });
  }
  return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
