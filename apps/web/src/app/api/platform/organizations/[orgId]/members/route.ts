import { NextResponse } from 'next/server';
import {
  attachPlatformOrganizationMember,
  invitePlatformOrganizationMember,
  listPlatformOrganizationMembers,
  provisionPlatformResponder,
  syncPlatformOrganizationMembersFromClerk,
} from '@/lib/platform-members';

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
  const result = await listPlatformOrganizationMembers(orgId);
  if (!result.ok) {
    return NextResponse.json(result, { status: statusFor(result.code) });
  }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request, { params }: Params) {
  const { orgId } = await params;
  let body: {
    action?: string;
    userRef?: string;
    email?: string;
    role?: string;
    track?: string;
    unitCode?: string;
    seedLabWorkOrder?: boolean;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: 'invalid', message: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (body.action === 'sync') {
    const result = await syncPlatformOrganizationMembersFromClerk(orgId);
    if (!result.ok) {
      return NextResponse.json(result, { status: statusFor(result.code) });
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (body.action === 'invite') {
    const result = await invitePlatformOrganizationMember({
      organizationId: orgId,
      email: String(body.email || body.userRef || ''),
      role: body.role,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: statusFor(result.code) });
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (body.action === 'provision_responder') {
    const result = await provisionPlatformResponder({
      organizationId: orgId,
      userRef: String(body.userRef || body.email || ''),
      track: body.track,
      unitCode: body.unitCode,
      seedLabWorkOrder: body.seedLabWorkOrder,
    });
    if (!result.ok) {
      return NextResponse.json(result, { status: statusFor(result.code) });
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  }

  const result = await attachPlatformOrganizationMember({
    organizationId: orgId,
    userRef: String(body.userRef || ''),
    role: body.role,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: statusFor(result.code) });
  }
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
