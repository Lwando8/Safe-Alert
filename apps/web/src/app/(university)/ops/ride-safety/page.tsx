import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { loadOpsTenantPresentation } from '@/lib/ops-tenant-presentation';

export const dynamic = 'force-dynamic';

/**
 * Phase G — Ride safety ops stub.
 * Foundation only: module-gated empty state. No matching / dispatch product yet.
 */
export default async function OpsRideSafetyPage() {
  const presentation = await loadOpsTenantPresentation();
  const enabled = presentation.modules.RIDE_SAFETY;

  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Ride safety
        </h1>
        <p className="text-sm text-muted-foreground">
          Escort / companion requests for {presentation.organizationId || 'your organisation'} —
          separate from emergency SOS.
        </p>
      </div>

      {!enabled ? (
        <Card>
          <CardHeader>
            <CardTitle>Module disabled</CardTitle>
            <CardDescription>
              Enable RIDE_SAFETY on this organisation&apos;s tenant profile to use this
              surface. Residential defaults keep it off unless overridden.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Foundation ready</CardTitle>
            <CardDescription>
              Profile: {presentation.tenantProfile}. Create/list callables are available
              for members; ops matching and live tracking are intentionally deferred
              (Phase G foundation only — not marketplace).
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </main>
  );
}
