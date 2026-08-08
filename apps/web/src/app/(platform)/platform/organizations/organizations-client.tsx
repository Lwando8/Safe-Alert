'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

export type OrgListItem = {
  id: string;
  name: string;
  slug: string;
  status?: string;
  tenantProfile?: string;
  modules?: Record<string, boolean>;
  clerkOrganizationId?: string | null;
  labMode?: boolean;
};

type Props = {
  initial:
    | { ok: true; organizations: OrgListItem[] }
    | { ok: false; code: string; message: string };
};

function guessSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function OrganizationsClient({ initial }: Props) {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgListItem[]>(
    initial.ok ? initial.organizations : []
  );
  const [loadError] = useState<string | null>(initial.ok ? null : initial.message);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [profile, setProfile] = useState<string>('UNIVERSITY');
  const [mode, setMode] = useState<'lab' | 'live'>('lab');
  const [linkClerkId, setLinkClerkId] = useState('');
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const derivedSlug = useMemo(
    () => (slugTouched ? slug : guessSlug(name)),
    [name, slug, slugTouched]
  );

  async function createOrg() {
    setCreating(true);
    setMsg(null);
    setErr(null);
    try {
      const res = await fetch('/api/platform/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug: derivedSlug,
          tenantProfile: profile,
          mode,
          clerkOrganizationId:
            mode === 'live' && linkClerkId.trim() ? linkClerkId.trim() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setErr(json.message || 'Create failed');
        return;
      }
      setMsg(
        `Created ${json.organizationId} (${json.mode}) · site ${json.siteId}` +
          (json.createdClerkOrg ? ' · new Clerk org' : '') +
          ` · ${json.clerkOrganizationId}`
      );
      setName('');
      setSlug('');
      setSlugTouched(false);
      setLinkClerkId('');
      router.refresh();
      const listRes = await fetch('/api/platform/organizations', { cache: 'no-store' });
      const listJson = await listRes.json();
      if (listRes.ok && listJson.ok) {
        setOrgs(listJson.organizations || []);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Organizations
        </h1>
        <p className="text-sm text-muted-foreground">
          Provision tenants (org + default site), then configure profile, modules, and
          members. Lab mode writes Firestore with a synthetic Clerk id; live creates or
          links a real Clerk organization.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create organization</CardTitle>
          <CardDescription>
            Lab requires the Firestore emulator. Live creates a Clerk org (or link an
            existing <code className="text-xs">org_…</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Display name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="off"
            />
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
              placeholder="slug (auto from name)"
              value={derivedSlug}
              onChange={e => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              autoComplete="off"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={profile}
              onChange={e => setProfile(e.target.value)}
            >
              {PROFILES.map(p => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={mode}
              onChange={e => setMode(e.target.value as 'lab' | 'live')}
            >
              <option value="lab">Lab (emulator)</option>
              <option value="live">Live (Clerk)</option>
            </select>
            <input
              className="rounded-md border bg-background px-3 py-2 text-sm font-mono disabled:opacity-50"
              placeholder="Optional: existing org_… to link"
              value={linkClerkId}
              onChange={e => setLinkClerkId(e.target.value)}
              disabled={mode !== 'live'}
              autoComplete="off"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => void createOrg()}
              disabled={creating || name.trim().length < 2 || derivedSlug.length < 2}
            >
              {creating ? 'Creating…' : 'Create organization'}
            </Button>
            {msg ? <p className="text-sm text-green-600">{msg}</p> : null}
            {err ? <p className="text-sm text-destructive">{err}</p> : null}
          </div>
        </CardContent>
      </Card>

      {loadError ? (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load organizations</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
        </Card>
      ) : orgs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No organizations yet</CardTitle>
            <CardDescription>
              Create one above, or run seed:phase2b / wait for Clerk webhook sync.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {orgs.map(org => (
            <Card key={org.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="text-base">
                    <Link
                      className="hover:underline"
                      href={`/platform/organizations/${org.id}`}
                    >
                      {org.name}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    slug: {org.slug} · status: {org.status || '—'}
                    {org.clerkOrganizationId
                      ? ` · ${org.clerkOrganizationId}`
                      : ''}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {org.labMode ? (
                    <Badge variant="outline">Lab</Badge>
                  ) : (
                    <Badge variant="secondary">Live</Badge>
                  )}
                  <Badge variant="secondary">
                    {org.tenantProfile || 'UNIVERSITY (default)'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                Modules:{' '}
                {org.modules
                  ? Object.entries(org.modules)
                      .filter(([, v]) => v)
                      .map(([k]) => k)
                      .join(', ') || 'none'
                  : 'profile defaults'}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
