import { loadOpsBroadcastsForSession } from '@/lib/ops-broadcasts';
import { BroadcastsClient } from './broadcasts-client';
import { isClerkConfigured } from '@/lib/auth-guards';

export const dynamic = 'force-dynamic';

export default async function OpsBroadcastsPage() {
  const result = await loadOpsBroadcastsForSession();
  const initial = result.ok
    ? {
        ok: true as const,
        organizationId: result.organizationId,
        broadcasts: result.broadcasts,
      }
    : {
        ok: false as const,
        code: result.code,
        message: result.message,
      };

  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <BroadcastsClient initial={initial} clerkEnabled={isClerkConfigured()} />
    </main>
  );
}
