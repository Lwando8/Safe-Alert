import Link from 'next/link';
import { listPlatformOrganizations } from '@/lib/platform-organizations';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function PlatformOrganizationsPage() {
  const result = await listPlatformOrganizations();

  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Organizations
        </h1>
        <p className="text-sm text-muted-foreground">
          Tenant profile and module configuration. Full provisioning remains
          incremental; this shell edits profile + modules safely.
        </p>
      </div>

      {!result.ok ? (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load organizations</CardTitle>
            <CardDescription>{result.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : result.organizations.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No organizations yet</CardTitle>
            <CardDescription>
              Organizations appear here after Clerk webhook sync / bootstrap.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {result.organizations.map(org => (
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
                  </CardDescription>
                </div>
                <Badge variant="secondary">
                  {org.tenantProfile || 'UNIVERSITY (default)'}
                </Badge>
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
    </main>
  );
}
