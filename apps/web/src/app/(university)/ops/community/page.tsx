import { loadOpsCommunityForSession } from '@/lib/ops-community';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function OpsCommunityPage() {
  const result = await loadOpsCommunityForSession();

  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Community</h1>
        <p className="text-sm text-muted-foreground">
          Groups, lean events, and community alerts (including Missing Pet).
          Moderation visibility for ops — not a social network.
        </p>
      </div>

      {!result.ok ? (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load community</CardTitle>
            <CardDescription>{result.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Groups</CardTitle>
              <CardDescription>{result.groups.length} visible</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {result.groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">No groups yet.</p>
              ) : (
                result.groups.map((g: Record<string, unknown>) => (
                  <div key={String(g.id)} className="rounded-md border px-3 py-2 text-sm">
                    <div className="font-medium">{String(g.name)}</div>
                    <div className="text-xs text-muted-foreground">
                      {String(g.category || 'general')}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Events</CardTitle>
              <CardDescription>{result.events.length} visible</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {result.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              ) : (
                result.events.map((e: Record<string, unknown>) => (
                  <div key={String(e.id)} className="rounded-md border px-3 py-2 text-sm">
                    <div className="font-medium">{String(e.title)}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.startsAt ? new Date(Number(e.startsAt)).toLocaleString() : '—'}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Community alerts</CardTitle>
              <CardDescription>
                Not official broadcasts · {result.alerts.length} recent
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {result.alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No alerts yet.</p>
              ) : (
                result.alerts.map((a: Record<string, unknown>) => (
                  <div
                    key={String(a.id)}
                    className="flex items-start justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium">{String(a.title)}</div>
                      <div className="text-xs text-muted-foreground">
                        {String(a.type)} · {String(a.status)}
                      </div>
                    </div>
                    <Badge variant="secondary">{String(a.type)}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}
