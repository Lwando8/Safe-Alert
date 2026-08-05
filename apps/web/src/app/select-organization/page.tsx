import { OrganizationList } from "@clerk/nextjs";

export default function SelectOrganizationPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            Select your university
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Choose which university you want to access
          </p>
        </div>
        
        <OrganizationList
          hidePersonal
          afterSelectOrganizationUrl="/ops"
          afterCreateOrganizationUrl="/ops"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-lg border border-border bg-card",
            },
          }}
        />
      </div>
    </div>
  );
}
