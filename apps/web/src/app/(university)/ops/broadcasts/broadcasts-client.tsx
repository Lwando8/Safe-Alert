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

type BroadcastRow = {
  id: string;
  title?: string;
  body?: string;
  severity?: string;
  status?: string;
  channel?: string;
  createdAt?: number;
};

type Props = {
  initial: {
    ok: boolean;
    organizationId?: string;
    broadcasts?: BroadcastRow[];
    message?: string;
  };
  clerkEnabled: boolean;
};

export function BroadcastsClient({ initial, clerkEnabled }: Props) {
  const { tenantEpoch } = useOpsTenantBoundary();
  const [rows, setRows] = useState<BroadcastRow[]>(initial.broadcasts || []);
  const [organizationId, setOrganizationId] = useState(initial.organizationId || '');
  const [error, setError] = useState<string | null>(
    initial.ok ? null : initial.message || null
  );
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [severity, setSeverity] = useState('info');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/ops/broadcasts', { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError(json.message || 'Failed to load broadcasts');
      return;
    }
    setError(null);
    setOrganizationId(json.organizationId);
    setRows(json.broadcasts || []);
  }, []);

  useEffect(() => {
    if (!clerkEnabled) return;
    void refresh();
  }, [clerkEnabled, refresh, tenantEpoch]);

  async function publish() {
    setSaving(true);
    try {
      const res = await fetch('/api/ops/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, severity }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.message || 'Publish failed');
        return;
      }
      setTitle('');
      setBody('');
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!clerkEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Authentication unavailable</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Official broadcasts
        </h1>
        <p className="text-sm text-muted-foreground">
          Distinct from Community Alerts. Channel tag:{' '}
          <code>official_broadcast</code> · org {organizationId || '—'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Publish broadcast</CardTitle>
          <CardDescription>
            Requires broadcasts:create. Never stored as a CommunityAlert.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <input
            className="rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="Message body"
            value={body}
            onChange={e => setBody(e.target.value)}
          />
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm"
            value={severity}
            onChange={e => setSeverity(e.target.value)}
          >
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="emergency">emergency</option>
          </select>
          <Button onClick={publish} disabled={saving || !title || !body}>
            {saving ? 'Publishing…' : 'Publish'}
          </Button>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {rows.map(row => (
          <Card key={row.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-base">{row.title}</CardTitle>
                <CardDescription>{row.body}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary">{row.channel || 'official_broadcast'}</Badge>
                <Badge>{row.severity || 'info'}</Badge>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
