'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useOpsTenantBoundary } from '@/components/ops-tenant-boundary';
import { slaStatusLabel, type SlaStatus } from '@/lib/ops-sla';

type RequestRow = {
  id: string;
  organizationId: string;
  category?: string;
  title?: string;
  status?: string;
  priority?: string;
  createdAt?: number;
  assignedUserId?: string | null;
  assignedTeamId?: string | null;
  workOrderId?: string | null;
  slaTargetAt?: number | null;
  slaStatus?: SlaStatus;
};

type TeamRow = {
  id: string;
  name: string;
  kind?: string;
};

type Props = {
  initial: {
    ok: boolean;
    organizationId?: string;
    requests?: RequestRow[];
    teams?: TeamRow[];
    permissions?: string[];
    code?: string;
    message?: string;
  };
  clerkEnabled: boolean;
};

function formatTime(ts?: number | null) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function slaBadgeVariant(
  status?: SlaStatus
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'breached':
      return 'destructive';
    case 'due_soon':
      return 'outline';
    case 'met':
      return 'secondary';
    case 'on_track':
      return 'default';
    default:
      return 'secondary';
  }
}

const NEXT_STATUS: Record<string, string[]> = {
  submitted: ['acknowledged', 'assigned'],
  acknowledged: ['in_progress', 'assigned', 'on_hold'],
  assigned: ['acknowledged', 'in_progress', 'on_hold'],
  in_progress: ['resolved', 'on_hold'],
  on_hold: ['in_progress', 'assigned'],
  resolved: ['closed'],
};

const PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const;

export function RequestsClient({ initial, clerkEnabled }: Props) {
  const { tenantEpoch } = useOpsTenantBoundary();
  const [rows, setRows] = useState<RequestRow[]>(initial.requests || []);
  const [teams, setTeams] = useState<TeamRow[]>(initial.teams || []);
  const [organizationId, setOrganizationId] = useState(initial.organizationId || '');
  const [permissions, setPermissions] = useState<string[]>(initial.permissions || []);
  const [error, setError] = useState<string | null>(
    initial.ok ? null : initial.message || 'Unable to load'
  );
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assignDraft, setAssignDraft] = useState<
    Record<string, { teamId: string; priority: string; slaHours: string }>
  >({});

  const canAssign = permissions.includes('requests:assign');
  const canUpdate =
    permissions.includes('requests:update') ||
    permissions.includes('requests:assign') ||
    permissions.includes('requests:resolve');

  const teamNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teams) map.set(t.id, t.name);
    return map;
  }, [teams]);

  const draftFor = useCallback(
    (row: RequestRow) => {
      return (
        assignDraft[row.id] || {
          teamId: row.assignedTeamId || teams[0]?.id || '',
          priority: row.priority || 'normal',
          slaHours: '',
        }
      );
    },
    [assignDraft, teams]
  );

  const setDraft = (requestId: string, patch: Partial<{ teamId: string; priority: string; slaHours: string }>) => {
    setAssignDraft(prev => {
      const base = prev[requestId] || {
        teamId: teams[0]?.id || '',
        priority: 'normal',
        slaHours: '',
      };
      return { ...prev, [requestId]: { ...base, ...patch } };
    });
  };

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
      setTeams(json.teams || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!clerkEnabled) return;
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
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
            team assignment + SLA targets (separate from SOS incidents).
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
            const draft = draftFor(row);
            const canShowAssign =
              canAssign &&
              ['submitted', 'acknowledged', 'on_hold', 'awaiting_information'].includes(
                row.status || ''
              );
            const teamLabel = row.assignedTeamId
              ? teamNameById.get(row.assignedTeamId) || row.assignedTeamId
              : null;

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
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge variant="secondary">{row.priority || 'normal'}</Badge>
                    <Badge>{row.status || 'submitted'}</Badge>
                    {row.slaStatus && row.slaStatus !== 'none' ? (
                      <Badge variant={slaBadgeVariant(row.slaStatus)}>
                        {slaStatusLabel(row.slaStatus)}
                      </Badge>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-xs text-muted-foreground">
                    Assignee: {row.assignedUserId || 'Unassigned'}
                    {teamLabel ? ` · Team: ${teamLabel}` : ''}
                    {row.slaTargetAt
                      ? ` · SLA due: ${formatTime(row.slaTargetAt)}`
                      : ''}
                  </p>

                  {canShowAssign ? (
                    <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-3">
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`team-${row.id}`}>Team</Label>
                        <select
                          id={`team-${row.id}`}
                          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                          value={draft.teamId}
                          onChange={e => setDraft(row.id, { teamId: e.target.value })}
                        >
                          <option value="">No team</option>
                          {teams.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                              {t.kind ? ` (${t.kind})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`pri-${row.id}`}>Priority</Label>
                        <select
                          id={`pri-${row.id}`}
                          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                          value={draft.priority}
                          onChange={e => setDraft(row.id, { priority: e.target.value })}
                        >
                          {PRIORITIES.map(p => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`sla-${row.id}`}>SLA hours (optional)</Label>
                        <input
                          id={`sla-${row.id}`}
                          type="number"
                          min={1}
                          placeholder="Default by priority"
                          className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                          value={draft.slaHours}
                          onChange={e => setDraft(row.id, { slaHours: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2 sm:col-span-3">
                        <Button
                          size="sm"
                          disabled={busyId === row.id || !draft.teamId}
                          onClick={() =>
                            mutate({
                              requestId: row.id,
                              action: 'assign',
                              assignedTeamId: draft.teamId || null,
                              assignedUserId: null,
                              priority: draft.priority,
                              slaHours: draft.slaHours
                                ? Number(draft.slaHours)
                                : null,
                            })
                          }
                        >
                          Assign to team
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === row.id}
                          onClick={() =>
                            mutate({
                              requestId: row.id,
                              action: 'assign',
                              assignedTeamId: draft.teamId || null,
                              priority: draft.priority,
                              slaHours: draft.slaHours
                                ? Number(draft.slaHours)
                                : null,
                            })
                          }
                        >
                          Assign to me
                          {draft.teamId ? ' + team' : ''}
                        </Button>
                      </div>
                      {!teams.length ? (
                        <p className="text-xs text-muted-foreground sm:col-span-3">
                          No facilities teams seeded for this org yet — you can still
                          assign to yourself. Seed includes team_a_facilities.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    {canUpdate
                      ? next
                          .filter(status => status !== 'assigned' || !canShowAssign)
                          .map(status => (
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
