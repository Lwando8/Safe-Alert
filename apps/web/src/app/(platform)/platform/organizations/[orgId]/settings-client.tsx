'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

const ATTACH_ROLES = [
  { value: 'org:student', label: 'Student (org:student)' },
  { value: 'org:staff', label: 'Staff (org:staff)' },
  { value: 'org:admin', label: 'Admin (org:admin)' },
  { value: 'org:member', label: 'Member (org:member → student)' },
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

type MemberRow = {
  id: string;
  userId: string;
  clerkRole?: string;
  kind?: string;
  status: string;
  siteId?: string;
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

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [labMode, setLabMode] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [userRef, setUserRef] = useState('');
  const [attachRole, setAttachRole] = useState<string>('org:student');
  const [attaching, setAttaching] = useState(false);
  const [attachMsg, setAttachMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    setMembersError(null);
    try {
      const res = await fetch(`/api/platform/organizations/${orgId}/members`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMembersError(json.message || 'Unable to load members');
        return;
      }
      setMembers(json.members || []);
      setLabMode(Boolean(json.labMode));
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : 'Unable to load members');
    } finally {
      setMembersLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (initial.ok) {
      void loadMembers();
    }
  }, [initial.ok, loadMembers]);

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

  async function attachMember() {
    setAttaching(true);
    setAttachMsg(null);
    setMembersError(null);
    try {
      const res = await fetch(`/api/platform/organizations/${orgId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userRef, role: attachRole }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMembersError(json.message || 'Attach failed');
        return;
      }
      setAttachMsg(
        `Attached ${json.userId} (${json.clerkRole}) via ${json.mode}${
          json.created ? ' — created' : ' — updated'
        }.`
      );
      setUserRef('');
      await loadMembers();
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : 'Attach failed');
    } finally {
      setAttaching(false);
    }
  }

  async function syncFromClerk() {
    setSyncing(true);
    setAttachMsg(null);
    setMembersError(null);
    try {
      const res = await fetch(`/api/platform/organizations/${orgId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setMembersError(json.message || 'Sync failed');
        return;
      }
      setAttachMsg(
        `Synced ${json.synced}/${json.total} Clerk members to Firestore` +
          (json.failed ? ` (${json.failed} failed)` : '') +
          '.'
      );
      await loadMembers();
    } catch (err) {
      setMembersError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
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
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Attach an existing Clerk user and sync a Firestore membership (server-authoritative
            for mobile PlatformSession). Student path replaces hand-running the device seed
            script.
            {labMode
              ? ' Lab mode: org has no live Clerk organization id — writes Firestore only while the emulator is connected.'
              : ' Live mode: creates/updates the Clerk org membership, then syncs Firestore.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Clerk user id (user_…) or email"
              value={userRef}
              onChange={e => setUserRef(e.target.value)}
              autoComplete="off"
            />
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={attachRole}
              onChange={e => setAttachRole(e.target.value)}
            >
              {ATTACH_ROLES.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <Button onClick={attachMember} disabled={attaching || !userRef.trim()}>
              {attaching ? 'Attaching…' : 'Attach member'}
            </Button>
          </div>
          {attachMsg ? <p className="text-sm text-green-600">{attachMsg}</p> : null}
          {membersError ? <p className="text-sm text-destructive">{membersError}</p> : null}
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Kind</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Site</th>
                </tr>
              </thead>
              <tbody>
                {membersLoading ? (
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={5}>
                      Loading…
                    </td>
                  </tr>
                ) : members.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-muted-foreground" colSpan={5}>
                      No Firestore memberships for this org yet.
                    </td>
                  </tr>
                ) : (
                  members.map(m => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{m.userId}</td>
                      <td className="px-3 py-2">{m.clerkRole || '—'}</td>
                      <td className="px-3 py-2">{m.kind || '—'}</td>
                      <td className="px-3 py-2">{m.status}</td>
                      <td className="px-3 py-2 font-mono text-xs">{m.siteId || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadMembers()}>
              Refresh members
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void syncFromClerk()}
              disabled={syncing || labMode}
              title={
                labMode
                  ? 'Requires a live clerkOrganizationId (not lab/emulator synthetic orgs)'
                  : 'Pull all Clerk org members into Firestore'
              }
            >
              {syncing ? 'Syncing…' : 'Sync from Clerk'}
            </Button>
          </div>
        </CardContent>
      </Card>

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
