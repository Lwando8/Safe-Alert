'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useOpsTenantBoundary } from '@/components/ops-tenant-boundary';
import { isClerkPublishableConfigured } from '@/lib/auth-guards';

export type OpsIncidentRow = {
  id: string;
  organizationId: string;
  siteId?: string | null;
  zoneId?: string | null;
  type?: string;
  category?: string;
  status?: string;
  mapStatus?: string;
  createdAt?: number;
  assignments?: Array<Record<string, unknown>>;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'empty'; organizationId: string }
  | { kind: 'ready'; organizationId: string; incidents: OpsIncidentRow[] }
  | {
      kind: 'error';
      code: string;
      message: string;
    };

function formatTime(ts?: number) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function assignedResponder(incident: OpsIncidentRow): string {
  const assignments = incident.assignments || [];
  if (!assignments.length) return 'Unassigned';
  const latest = assignments[assignments.length - 1]!;
  return String(
    latest.name || latest.responderId || latest.responderUnitId || 'Assigned',
  );
}

type IncidentsClientProps = {
  initial: {
    ok: boolean;
    organizationId?: string;
    incidents?: OpsIncidentRow[];
    code?: string;
    message?: string;
  };
  clerkEnabled: boolean;
};

export function IncidentsClient({ initial, clerkEnabled }: IncidentsClientProps) {
  if (!clerkEnabled || !isClerkPublishableConfigured()) {
    return (
      <StateCard
        title="Authentication unavailable"
        description={
          initial.message ||
          'Clerk keys are not configured in this environment. Classify Clerk path as externally blocked until keys are provided.'
        }
      />
    );
  }

  return <IncidentsClientAuthed initial={initial} />;
}

function IncidentsClientAuthed({
  initial,
}: {
  initial: IncidentsClientProps['initial'];
}) {
  const { signOut } = useAuth();
  const { activeOrgKey, tenantEpoch, isSignedIn } = useOpsTenantBoundary();

  const [state, setState] = useState<LoadState>(() => {
    if (initial.ok && initial.organizationId) {
      if (!initial.incidents?.length) {
        return { kind: 'empty', organizationId: initial.organizationId };
      }
      return {
        kind: 'ready',
        organizationId: initial.organizationId,
        incidents: initial.incidents,
      };
    }
    return {
      kind: 'error',
      code: initial.code || 'error',
      message: initial.message || 'Unable to load incidents.',
    };
  });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/ops/incidents', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      const body = (await res.json()) as {
        ok: boolean;
        organizationId?: string;
        incidents?: OpsIncidentRow[];
        code?: string;
        message?: string;
      };

      if (!body.ok) {
        setState({
          kind: 'error',
          code: body.code || String(res.status),
          message: body.message || 'Request failed',
        });
        return;
      }

      const org = body.organizationId || 'unknown';
      if (!body.incidents?.length) {
        setState({ kind: 'empty', organizationId: org });
        return;
      }
      setState({ kind: 'ready', organizationId: org, incidents: body.incidents });
    } catch {
      setState({
        kind: 'error',
        code: 'unavailable',
        message: 'Incident service unavailable.',
      });
    }
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    const timer = window.setTimeout(() => {
      setState({ kind: 'loading' });
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeOrgKey, tenantEpoch, isSignedIn, load]);

  // Clear tenant data on sign-out without setState-in-effect
  const signedOutState =
    !isSignedIn
      ? ({
          kind: 'error' as const,
          code: 'unauthenticated' as const,
          message: 'Signed out. Incident data cleared.',
        })
      : null;
  const viewState = signedOutState || state;

  if (viewState.kind === 'loading') {
    return (
      <StateCard
        title="Loading incidents…"
        description="Resolving organization membership and tenant-scoped incidents."
      />
    );
  }

  if (viewState.kind === 'error') {
    return (
      <StateCard
        title={titleForCode(viewState.code)}
        description={viewState.message}
        action={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
            {viewState.code === 'unauthenticated' ? (
              <Button type="button" variant="secondary" onClick={() => void signOut()}>
                Confirm sign out
              </Button>
            ) : null}
          </div>
        }
      />
    );
  }

  const organizationId = viewState.organizationId;
  const incidents = viewState.kind === 'ready' ? viewState.incidents : [];
  const showOrgDiagnostics = process.env.NODE_ENV === 'development';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Incidents</h1>
          <p className="text-sm text-muted-foreground">
            Tenant-scoped control room list from the Phase 2B backend. Lifecycle actions unchanged.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {showOrgDiagnostics ? (
        <p className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
          diagnostics: organizationId={organizationId} · authProvider=clerk · orgKey=
          {activeOrgKey} · epoch={tenantEpoch}
        </p>
      ) : null}

      {viewState.kind === 'empty' ? (
        <StateCard
          title="No incidents"
          description={`No incidents found for organization ${organizationId}.`}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Active organization incidents</CardTitle>
            <CardDescription>
              Showing only incidents stamped with the server-resolved organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 font-medium">Incident ID</th>
                  <th className="px-2 py-2 font-medium">Category</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Site / zone</th>
                  <th className="px-2 py-2 font-medium">Created</th>
                  <th className="px-2 py-2 font-medium">Assigned responder</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map(incident => (
                  <tr key={incident.id} className="border-b border-border/60 last:border-0">
                    <td className="px-2 py-3 font-mono text-xs">{incident.id}</td>
                    <td className="px-2 py-3 capitalize">
                      {incident.category || incident.type || '—'}
                    </td>
                    <td className="px-2 py-3">
                      <Badge variant="secondary">{incident.status || '—'}</Badge>
                      {incident.mapStatus ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {incident.mapStatus}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-3 text-xs">
                      <div>{incident.siteId || '—'}</div>
                      <div className="text-muted-foreground">{incident.zoneId || 'no zone'}</div>
                    </td>
                    <td className="px-2 py-3 text-xs">{formatTime(incident.createdAt)}</td>
                    <td className="px-2 py-3 text-xs">{assignedResponder(incident)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function titleForCode(code: string) {
  switch (code) {
    case 'unauthenticated':
      return 'Unauthorized';
    case 'no_organization':
      return 'Organization required';
    case 'no_membership':
      return 'Membership inactive';
    case 'permission_denied':
      return 'Permission denied';
    case 'unavailable':
      return 'Service unavailable';
    case 'clerk_unconfigured':
      return 'Authentication unavailable';
    default:
      return 'Unable to load incidents';
  }
}

function StateCard({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {action ? <CardContent>{action}</CardContent> : null}
    </Card>
  );
}
