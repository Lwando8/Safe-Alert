'use client';

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

export type OpsResponderUnitRow = {
  id: string;
  organizationId: string;
  unitCode?: string;
  name?: string;
  active?: boolean;
  status?: string;
  responderType?: string;
};

export type OpsResponderMembershipRow = {
  id: string;
  userId: string;
  kind?: string;
  clerkRole?: string;
  unitCode?: string | null;
  siteId?: string | null;
};

type LoadState =
  | { kind: 'loading' }
  | {
      kind: 'ready';
      organizationId: string;
      units: OpsResponderUnitRow[];
      memberships: OpsResponderMembershipRow[];
    }
  | { kind: 'empty'; organizationId: string }
  | { kind: 'error'; code: string; message: string };

type RespondersClientProps = {
  initial: {
    ok: boolean;
    organizationId?: string;
    units?: OpsResponderUnitRow[];
    memberships?: OpsResponderMembershipRow[];
    code?: string;
    message?: string;
  };
  clerkEnabled: boolean;
};

export function RespondersClient({ initial, clerkEnabled }: RespondersClientProps) {
  if (!clerkEnabled || !isClerkPublishableConfigured()) {
    return (
      <StateCard
        title="Authentication unavailable"
        description={
          initial.message ||
          'Clerk keys are not configured in this environment.'
        }
      />
    );
  }

  return <RespondersClientInner initial={initial} />;
}

function RespondersClientInner({
  initial,
}: {
  initial: RespondersClientProps['initial'];
}) {
  const { tenantEpoch } = useOpsTenantBoundary();
  const [state, setState] = useState<LoadState>(() => {
    if (initial.ok && initial.organizationId) {
      const units = initial.units || [];
      const memberships = initial.memberships || [];
      if (!units.length && !memberships.length) {
        return { kind: 'empty', organizationId: initial.organizationId };
      }
      return {
        kind: 'ready',
        organizationId: initial.organizationId,
        units,
        memberships,
      };
    }
    return {
      kind: 'error',
      code: initial.code || 'error',
      message: initial.message || 'Unable to load responders',
    };
  });

  const refresh = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/ops/responders', { cache: 'no-store' });
      const body = (await res.json()) as {
        ok: boolean;
        organizationId?: string;
        units?: OpsResponderUnitRow[];
        memberships?: OpsResponderMembershipRow[];
        code?: string;
        message?: string;
      };
      if (!body.ok || !body.organizationId) {
        setState({
          kind: 'error',
          code: body.code || String(res.status),
          message: body.message || 'Failed to load responders',
        });
        return;
      }
      const units = body.units || [];
      const memberships = body.memberships || [];
      if (!units.length && !memberships.length) {
        setState({ kind: 'empty', organizationId: body.organizationId });
        return;
      }
      setState({
        kind: 'ready',
        organizationId: body.organizationId,
        units,
        memberships,
      });
    } catch (err) {
      setState({
        kind: 'error',
        code: 'error',
        message: err instanceof Error ? err.message : 'Failed to load responders',
      });
    }
  }, []);

  useEffect(() => {
    if (tenantEpoch > 0) {
      void refresh();
    }
  }, [tenantEpoch, refresh]);

  if (state.kind === 'loading') {
    return <StateCard title="Loading responders" description="Refreshing tenant roster…" />;
  }
  if (state.kind === 'error') {
    return (
      <StateCard
        title="Responders unavailable"
        description={`${state.code}: ${state.message}`}
        action={<Button onClick={() => void refresh()}>Retry</Button>}
      />
    );
  }
  if (state.kind === 'empty') {
    return (
      <StateCard
        title="No responders yet"
        description={`Organization ${state.organizationId} has no units or responder memberships.`}
        action={<Button onClick={() => void refresh()}>Refresh</Button>}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Responders</h1>
          <p className="text-sm text-muted-foreground">
            Tenant-scoped units and memberships for {state.organizationId}
          </p>
        </div>
        <Button variant="outline" onClick={() => void refresh()}>
          Refresh
        </Button>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Units</CardTitle>
            <CardDescription>{state.units.length} responder unit(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.units.length === 0 ? (
              <p className="text-sm text-muted-foreground">No units in this organization.</p>
            ) : (
              state.units.map(unit => (
                <div
                  key={unit.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{unit.name || unit.unitCode || unit.id}</div>
                    <div className="text-muted-foreground">{unit.responderType || 'unit'}</div>
                  </div>
                  <Badge variant={unit.active === false ? 'secondary' : 'default'}>
                    {unit.status || (unit.active === false ? 'inactive' : 'active')}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Memberships</CardTitle>
            <CardDescription>
              {state.memberships.length} security / control-room membership(s)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.memberships.length === 0 ? (
              <p className="text-sm text-muted-foreground">No responder memberships.</p>
            ) : (
              state.memberships.map(m => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{m.userId}</div>
                    <div className="text-muted-foreground">
                      {m.kind || 'member'}
                      {m.unitCode ? ` · ${m.unitCode}` : ''}
                    </div>
                  </div>
                  <Badge variant="outline">{m.clerkRole || 'role'}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
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
