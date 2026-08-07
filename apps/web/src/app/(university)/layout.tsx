import { ShellNav } from "@/components/shell-nav";
import { OpsTenantBoundary } from "@/components/ops-tenant-boundary";

const navItems = [
  { href: "/ops", label: "Command overview" },
  { href: "/ops/incidents", label: "Incidents" },
  { href: "/ops/requests", label: "Facilities requests" },
  { href: "/ops/responders", label: "Responders" },
  { href: "/ops/campus", label: "Campus & zones" },
  { href: "/ops/community", label: "Community" },
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
        showOrgSwitcher
        footer="Organization-scoped control room · Phase 2C tenant boundary"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <OpsTenantBoundary>{children}</OpsTenantBoundary>
      </div>
    </div>
  );
}
