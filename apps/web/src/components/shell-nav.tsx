import Link from "next/link";
import { cn } from "@/lib/utils";

export type ShellNavItem = {
  href: string;
  label: string;
};

type ShellNavProps = {
  brand: string;
  brandHref: string;
  items: ShellNavItem[];
  footer?: React.ReactNode;
  className?: string;
  /** Platform super-admin uses a darker chrome, separate from university ops */
  variant?: "university" | "platform";
};

export function ShellNav({
  brand,
  brandHref,
  items,
  footer,
  className,
  variant = "university",
}: ShellNavProps) {
  return (
    <aside
      data-shell={variant}
      className={cn(
        "flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        variant === "platform" &&
          "bg-[oklch(0.16_0.025_185)] text-[oklch(0.95_0.01_185)] border-[oklch(1_0_0_/_0.08)]",
        className,
      )}
    >
      <div className="border-b border-sidebar-border px-5 py-5">
        <Link href={brandHref} className="font-display text-lg font-semibold tracking-tight">
          {brand}
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors",
              variant === "platform"
                ? "text-white/75 hover:bg-white/10 hover:text-white"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {footer ? (
        <div
          className={cn(
            "border-t p-4 text-xs",
            variant === "platform"
              ? "border-white/10 text-white/55"
              : "border-sidebar-border text-muted-foreground",
          )}
        >
          {footer}
        </div>
      ) : null}
    </aside>
  );
}
