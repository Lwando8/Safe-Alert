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

export function RequestsClient({ initial, clerkEnabled }: Props) {
  const { tenantEpoch } = useOpsTenantBoundary();
  const [rows, setRows] = useState<RequestRow[]>(initial.requests || []);
  const [organizationId, setOrganizationId] = useState(initial.organizationId || '');
  const [error, setError] = useState<string | null>(
    initial.ok ? null : initial.message || 'Unable to load'
  );
  const [loading, setLoading] = useState(false);

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
            <CardTitle>Unable to load queue</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : rows.length === 0 ? (
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
          {rows.map(row => (
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
              <CardContent className="text-xs text-muted-foreground">
                Assignee: {row.assignedUserId || 'Unassigned'}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
