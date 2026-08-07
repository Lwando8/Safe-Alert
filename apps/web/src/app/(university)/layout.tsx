import { ShellNav } from "@/components/shell-nav";
import { OpsTenantBoundary } from "@/components/ops-tenant-boundary";
import { loadOpsTenantPresentation } from "@/lib/ops-tenant-presentation";

export default async function UniversityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const presentation = await loadOpsTenantPresentation();
  const t = presentation.terminology;
  const m = presentation.modules;

  const navItems = [
    { href: "/ops", label: "Command overview", show: true },
    { href: "/ops/incidents", label: t.incident + "s", show: m.SAFETY },
    {
      href: "/ops/requests",
      label: `${t.request}s`,
      show: m.OPERATIONS,
    },
    { href: "/ops/responders", label: `${t.responder}s`, show: m.SAFETY },
    {
      href: "/ops/campus",
      label: `${t.site} & zones`,
      show: m.SAFETY || m.OPERATIONS,
    },
    {
      href: "/ops/community",
      label: "Community",
      show: m.COMMUNITY || m.GROUPS || m.EVENTS || m.COMMUNITY_ALERTS,
    },
    { href: "/ops/broadcasts", label: "Broadcasts", show: m.BROADCASTS },
    { href: "/ops/ride-safety", label: "Ride safety", show: m.RIDE_SAFETY },
    { href: "/ops/analytics", label: "Analytics", show: m.ANALYTICS },
    { href: "/ops/settings", label: "Roles & settings", show: true },
  ].filter(item => item.show);

  return (
    <div className="flex min-h-full flex-1 bg-background">
      <ShellNav
        brand={`${t.organization} Ops`}
        brandHref="/ops"
        items={navItems.map(({ href, label }) => ({ href, label }))}
        showOrgSwitcher
        footer="Organization-scoped control room · module-gated nav"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <OpsTenantBoundary>{children}</OpsTenantBoundary>
      </div>
    </div>
  );
}
