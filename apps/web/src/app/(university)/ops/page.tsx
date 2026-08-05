export default function UniversityOpsHomePage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Control room</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Live incident command
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Placeholder shell for campus incident command, responder availability,
          and dispatch. Wired to tenant-scoped data in Phase 5 — not connected in
          Phase 1.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Open incidents", body: "Scoped by organization and site." },
          { title: "Responders on shift", body: "Approved guards only." },
          { title: "Broadcasts", body: "Campus safety messaging." },
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
