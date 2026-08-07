import { loadOpsAnalyticsForSession } from '@/lib/ops-analytics';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function OpsAnalyticsPage() {
  const result = await loadOpsAnalyticsForSession();

  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Server-captured events for requests, community alerts, and broadcasts.
          No AI — operational metrics only.
        </p>
      </div>

      {!result.ok ? (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load analytics</CardTitle>
            <CardDescription>{result.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(result.counts).map(([kind, count]) => (
              <Card key={kind}>
                <CardHeader className="pb-2">
                  <CardDescription>{kind}</CardDescription>
                  <CardTitle className="text-2xl">{count}</CardTitle>
                </CardHeader>
              </Card>
            ))}
            {Object.keys(result.counts).length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>No events yet</CardTitle>
                  <CardDescription>
                    Events appear when requests, alerts, or broadcasts are written.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : null}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent events</CardTitle>
              <CardDescription>Org {result.organizationId}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {result.events.slice(0, 40).map(event => (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{String(event.kind)}</div>
                    <div className="text-xs text-muted-foreground">
                      {String(event.resourceType)}/{String(event.resourceId)}
                      {event.category ? ` · ${String(event.category)}` : ''}
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {event.createdAt
                      ? new Date(Number(event.createdAt)).toLocaleString()
                      : '—'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
