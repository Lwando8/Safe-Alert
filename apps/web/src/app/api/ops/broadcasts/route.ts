import { NextResponse } from 'next/server';
import { createOpsBroadcast, loadOpsBroadcastsForSession } from '@/lib/ops-broadcasts';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.has('organizationId')) {
    // ignored
  }
  const result = await loadOpsBroadcastsForSession();
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

export async function POST(request: Request) {
  let body: { title?: string; body?: string; severity?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: 'invalid', message: 'Invalid JSON' },
      { status: 400 }
    );
  }
  const result = await createOpsBroadcast({
    title: String(body.title || ''),
    body: String(body.body || ''),
    severity: body.severity,
  });
  if (!result.ok) {
    const status =
      result.code === 'unauthenticated'
        ? 401
        : result.code === 'permission_denied' || result.code === 'no_membership'
          ? 403
          : result.code === 'invalid'
            ? 400
            : 503;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { status: 201 });
}
