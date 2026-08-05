import { ShellNav } from "@/components/shell-nav";

const navItems = [
  { href: "/platform", label: "Overview" },
  { href: "/platform/organizations", label: "Organizations" },
  { href: "/platform/health", label: "Platform health" },
  { href: "/platform/audit", label: "Platform audit" },
  { href: "/platform/flags", label: "Feature flags" },
];

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 bg-background">
      <ShellNav
        brand="Seren Platform"
        brandHref="/platform"
        items={navItems}
        variant="platform"
        footer="Cross-tenant super-admin · separate from university ops"
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
