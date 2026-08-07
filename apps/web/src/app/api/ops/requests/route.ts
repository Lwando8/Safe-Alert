import { NextResponse } from 'next/server';
import {
  assignOpsRequest,
  loadOpsRequestsForSession,
  updateOpsRequestStatus,
} from '@/lib/ops-requests';

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

export async function PATCH(request: Request) {
  let body: {
    requestId?: string;
    action?: 'status' | 'assign';
    status?: string;
    assignedUserId?: string | null;
    assignedTeamId?: string | null;
    priority?: string | null;
    slaTargetAt?: number | null;
    slaHours?: number | null;
    resolutionSummary?: string;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: 'invalid', message: 'Invalid JSON' },
      { status: 400 }
    );
  }

  if (!body.requestId) {
    return NextResponse.json(
      { ok: false, code: 'invalid', message: 'requestId required' },
      { status: 400 }
    );
  }

  const result =
    body.action === 'assign'
      ? await assignOpsRequest({
          requestId: body.requestId,
          assignedUserId: body.assignedUserId,
          assignedTeamId: body.assignedTeamId,
          priority: body.priority,
          slaTargetAt: body.slaTargetAt,
          slaHours: body.slaHours,
        })
      : await updateOpsRequestStatus({
          requestId: body.requestId,
          status: String(body.status || ''),
          resolutionSummary: body.resolutionSummary,
        });

  if (!result.ok) {
    const status =
      result.code === 'unauthenticated'
        ? 401
        : result.code === 'permission_denied' || result.code === 'no_membership'
          ? 403
          : result.code === 'not_found'
            ? 404
            : result.code === 'invalid'
              ? 400
              : 503;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
