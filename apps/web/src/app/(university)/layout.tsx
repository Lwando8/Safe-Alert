import { ShellNav } from "@/components/shell-nav";

const navItems = [
  { href: "/ops", label: "Command overview" },
  { href: "/ops/incidents", label: "Incidents" },
  { href: "/ops/responders", label: "Responders" },
  { href: "/ops/campus", label: "Campus & zones" },
  { href: "/ops/broadcasts", label: "Broadcasts" },
  { href: "/ops/analytics", label: "Analytics" },
  { href: "/ops/settings", label: "Roles & settings" },
];

export default function UniversityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 bg-background">
      <ShellNav
        brand="University Ops"
        brandHref="/ops"
        items={navItems}
        footer="Organization-scoped control room · Phase 1 shell"
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
