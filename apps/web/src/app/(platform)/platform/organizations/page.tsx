import { listPlatformOrganizations } from '@/lib/platform-organizations';
import { OrganizationsClient } from './organizations-client';

export const dynamic = 'force-dynamic';

export default async function PlatformOrganizationsPage() {
  const result = await listPlatformOrganizations();

  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <OrganizationsClient
        initial={
          result.ok
            ? { ok: true, organizations: result.organizations }
            : { ok: false, code: result.code, message: result.message }
        }
      />
    </main>
  );
}
