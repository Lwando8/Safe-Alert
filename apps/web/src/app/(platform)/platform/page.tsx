export default function PlatformHomePage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Seren platform</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Super-admin console
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Provision and supervise organizations (universities). This surface stays
          separate from each university&apos;s operational control room.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {[
          {
            title: "Organizations",
            body: "Create, suspend, and configure tenants.",
          },
          {
            title: "Adoption & health",
            body: "Aggregate metrics only — no day-to-day campus dispatch.",
          },
        ].map((card) => (
          <div
            key={card.title}
            className="rounded-xl border border-border bg-card p-5 text-card-foreground"
          >
            <h2 className="text-sm font-semibold">{card.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{card.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
