'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOpsTenantBoundary } from '@/components/ops-tenant-boundary';

type RequestRow = {
  id: string;
  organizationId: string;
  category?: string;
  title?: string;
  status?: string;
  priority?: string;
  createdAt?: number;
  assignedUserId?: string | null;
  workOrderId?: string | null;
};

type Props = {
  initial: {
    ok: boolean;
    organizationId?: string;
    requests?: RequestRow[];
    permissions?: string[];
    code?: string;
    message?: string;
  };
  clerkEnabled: boolean;
};

function formatTime(ts?: number) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

const NEXT_STATUS: Record<string, string[]> = {
  submitted: ['acknowledged', 'assigned'],
  acknowledged: ['assigned', 'on_hold'],
  assigned: ['in_progress', 'on_hold'],
  in_progress: ['resolved', 'on_hold'],
  on_hold: ['in_progress', 'assigned'],
  resolved: ['closed'],
};

export function RequestsClient({ initial, clerkEnabled }: Props) {
  const { tenantEpoch } = useOpsTenantBoundary();
  const [rows, setRows] = useState<RequestRow[]>(initial.requests || []);
  const [organizationId, setOrganizationId] = useState(initial.organizationId || '');
  const [permissions, setPermissions] = useState<string[]>(initial.permissions || []);
  const [error, setError] = useState<string | null>(
    initial.ok ? null : initial.message || 'Unable to load'
  );
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canAssign = permissions.includes('requests:assign');
  const canUpdate =
    permissions.includes('requests:update') ||
    permissions.includes('requests:assign') ||
    permissions.includes('requests:resolve');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ops/requests', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.message || 'Failed to load requests');
        setRows([]);
        return;
      }
      setError(null);
      setOrganizationId(json.organizationId);
      setPermissions(json.permissions || []);
      setRows(json.requests || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!clerkEnabled) return;
    void refresh();
  }, [clerkEnabled, refresh, tenantEpoch]);

  async function mutate(body: Record<string, unknown>) {
    setBusyId(String(body.requestId || ''));
    setError(null);
    try {
      const res = await fetch('/api/ops/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.message || 'Action failed');
        return;
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  if (!clerkEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Authentication unavailable</CardTitle>
          <CardDescription>Clerk keys are not configured.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Facilities requests
          </h1>
          <p className="text-sm text-muted-foreground">
            Operational requests for {organizationId || 'your organization'} —
            separate from SOS incidents.
          </p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Notice</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!error && rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No open requests</CardTitle>
            <CardDescription>
              Members can submit via mobile Report an Issue when OPERATIONS is enabled.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map(row => {
            const next = NEXT_STATUS[row.status || ''] || [];
            return (
              <Card key={row.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div>
                    <CardTitle className="text-base">{row.title || row.id}</CardTitle>
                    <CardDescription>
                      {row.category || 'general'} · {formatTime(row.createdAt)}
                      {row.workOrderId ? ` · WO ${row.workOrderId}` : ''}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">{row.priority || 'normal'}</Badge>
                    <Badge>{row.status || 'submitted'}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-xs text-muted-foreground">
                    Assignee: {row.assignedUserId || 'Unassigned'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {canAssign &&
                    ['submitted', 'acknowledged', 'on_hold'].includes(row.status || '') ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === row.id}
                        onClick={() =>
                          mutate({ requestId: row.id, action: 'assign' })
                        }
                      >
                        Assign to me
                      </Button>
                    ) : null}
                    {canUpdate
                      ? next.map(status => (
                          <Button
                            key={status}
                            size="sm"
                            variant="outline"
                            disabled={busyId === row.id}
                            onClick={() =>
                              mutate({
                                requestId: row.id,
                                action: 'status',
                                status,
                              })
                            }
                          >
                            Mark {status}
                          </Button>
                        ))
                      : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
