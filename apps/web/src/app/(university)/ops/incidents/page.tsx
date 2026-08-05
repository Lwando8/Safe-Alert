import { loadOpsIncidentsForSession } from '@/lib/ops-incidents';
import { IncidentsClient } from './incidents-client';

export const dynamic = 'force-dynamic';

function clerkConfigured(): boolean {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
  const sk = process.env.CLERK_SECRET_KEY ?? '';
  return (
    pk.startsWith('pk_') &&
    sk.startsWith('sk_') &&
    !pk.includes('your_key') &&
    !sk.includes('your_key')
  );
}

export default async function IncidentsPage() {
  const result = await loadOpsIncidentsForSession();

  const initial = result.ok
    ? {
        ok: true as const,
        organizationId: result.organizationId,
        incidents: result.incidents,
      }
    : {
        ok: false as const,
        code: result.code,
        message: result.message,
      };

  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <IncidentsClient initial={initial} clerkEnabled={clerkConfigured()} />
    </main>
  );
}
