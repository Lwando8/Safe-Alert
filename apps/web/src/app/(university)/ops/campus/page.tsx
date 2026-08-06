import { loadOpsCampusForSession } from '@/lib/ops-campus';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function CampusPage() {
  const result = await loadOpsCampusForSession();

  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Campus</h1>
      <p className="text-sm text-muted-foreground">
        Tenant-scoped sites for the active organization (Phase 2C wiring).
      </p>

      {!result.ok ? (
        <Card>
          <CardHeader>
            <CardTitle>Campus unavailable</CardTitle>
            <CardDescription>
              {result.code}: {result.message}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sites · {result.organizationId}</CardTitle>
            <CardDescription>{result.sites.length} site(s)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.sites.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sites provisioned.</p>
            ) : (
              result.sites.map(site => (
                <div
                  key={site.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{site.name || site.slug || site.id}</div>
                    <div className="text-muted-foreground">{site.slug || site.id}</div>
                  </div>
                  <Badge variant="outline">{site.status || 'unknown'}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
