'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const PROFILES = [
  'UNIVERSITY',
  'RESIDENTIAL',
  'BUSINESS_PARK',
  'CORPORATE_CAMPUS',
  'STUDENT_RESIDENCE',
  'GENERAL_COMMUNITY',
] as const;

const MODULES = [
  'SAFETY',
  'OPERATIONS',
  'COMMUNITY',
  'GROUPS',
  'EVENTS',
  'COMMUNITY_ALERTS',
  'RIDE_SAFETY',
  'BROADCASTS',
  'ANALYTICS',
] as const;

type OrgPayload = {
  id: string;
  name: string;
  slug: string;
  status?: string;
  tenantProfile?: string;
  modules?: Record<string, boolean>;
  settings?: Record<string, unknown>;
};

type Props = {
  orgId: string;
  initial:
    | { ok: true; organization: OrgPayload }
    | { ok: false; code: string; message: string };
};

export function OrganizationSettingsClient({ orgId, initial }: Props) {
  const [org, setOrg] = useState<OrgPayload | null>(
    initial.ok ? initial.organization : null
  );
  const [error, setError] = useState<string | null>(
    initial.ok ? null : initial.message
  );
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(
    initial.ok ? initial.organization.tenantProfile || 'UNIVERSITY' : 'UNIVERSITY'
  );
  const initialModules = useMemo(() => {
    const base: Record<string, boolean> = {};
    for (const m of MODULES) base[m] = true;
    if (initial.ok && initial.organization.modules) {
      return { ...base, ...initial.organization.modules };
    }
    return base;
  }, [initial]);
  const [modules, setModules] = useState<Record<string, boolean>>(initialModules);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSavedMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/platform/organizations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantProfile: profile, modules }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.message || 'Save failed');
        return;
      }
      setOrg(json.organization);
      setSavedMsg('Saved tenant profile and modules.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!org) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization unavailable</CardTitle>
          <CardDescription>{error || 'Not found'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link className="text-sm text-primary underline" href="/platform/organizations">
            Back to organizations
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/platform/organizations" className="hover:underline">
              Organizations
            </Link>{' '}
            / {org.slug}
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {org.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Profile supplies defaults; module toggles override per organization.
            Server enforces modules — client never trusts these flags alone.
          </p>
        </div>
        <Badge variant="secondary">{org.status || 'active'}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tenant profile</CardTitle>
          <CardDescription>Drives default modules, categories, and labels.</CardDescription>
        </CardHeader>
        <CardContent>
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={profile}
            onChange={e => setProfile(e.target.value)}
          >
            {PROFILES.map(p => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modules</CardTitle>
          <CardDescription>
            Disabled modules fail closed on write callables (failed-precondition).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {MODULES.map(mod => (
            <label
              key={mod}
              className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={modules[mod] !== false}
                onChange={e =>
                  setModules(prev => ({ ...prev, [mod]: e.target.checked }))
                }
              />
              {mod}
            </label>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        {savedMsg ? <p className="text-sm text-green-600">{savedMsg}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
