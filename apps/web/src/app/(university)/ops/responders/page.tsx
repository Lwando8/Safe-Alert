import { loadOpsRespondersForSession } from '@/lib/ops-responders';
import { RespondersClient } from './responders-client';

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

export default async function RespondersPage() {
  const result = await loadOpsRespondersForSession();

  const initial = result.ok
    ? {
        ok: true as const,
        organizationId: result.organizationId,
        units: result.units,
        memberships: result.memberships,
      }
    : {
        ok: false as const,
        code: result.code,
        message: result.message,
      };

  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <RespondersClient initial={initial} clerkEnabled={clerkConfigured()} />
    </main>
  );
}
