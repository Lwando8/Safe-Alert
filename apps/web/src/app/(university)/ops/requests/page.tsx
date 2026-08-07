import { loadOpsRequestsForSession } from '@/lib/ops-requests';
import { RequestsClient } from './requests-client';
import { isClerkConfigured } from '@/lib/auth-guards';

export const dynamic = 'force-dynamic';

export default async function OpsRequestsPage() {
  const result = await loadOpsRequestsForSession();
  const initial = result.ok
    ? {
        ok: true as const,
        organizationId: result.organizationId,
        requests: result.requests,
        permissions: result.permissions,
      }
    : {
        ok: false as const,
        code: result.code,
        message: result.message,
      };

  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <RequestsClient initial={initial} clerkEnabled={isClerkConfigured()} />
    </main>
  );
}
