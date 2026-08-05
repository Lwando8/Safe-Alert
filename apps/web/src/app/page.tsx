import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-10 px-6 py-16">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium tracking-wide text-muted-foreground">
          Seren SOS
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
          Campus safety dashboards
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
          Phase 1 foundation shells. University operations and the Seren platform
          console are separate surfaces — pick a destination to continue.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button render={<Link href="/ops" />}>University operations</Button>
        <Button variant="outline" render={<Link href="/platform" />}>
          Seren platform admin
        </Button>
        <Button variant="outline" render={<Link href="/gallery" />}>
          Component gallery
        </Button>
      </div>
    </main>
  );
}
