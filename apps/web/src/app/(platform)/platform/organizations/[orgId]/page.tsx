import { getPlatformOrganization } from '@/lib/platform-organizations';
import { OrganizationSettingsClient } from './settings-client';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ orgId: string }> };

export default async function PlatformOrganizationDetailPage({ params }: Params) {
  const { orgId } = await params;
  const result = await getPlatformOrganization(orgId);

  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <OrganizationSettingsClient
        orgId={orgId}
        initial={
          result.ok
            ? {
                ok: true,
                organization: result.organization,
              }
            : {
                ok: false,
                code: result.code,
                message: result.message,
              }
        }
      />
    </main>
  );
}
