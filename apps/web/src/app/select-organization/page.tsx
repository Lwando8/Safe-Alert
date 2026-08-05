import { OrganizationList } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/auth-guards";

export default function SelectOrganizationPage() {
  if (!isClerkConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-lg rounded-md border border-dashed border-border bg-card p-6 text-center">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Select your university
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Clerk is not configured for this deployment. Set{" "}
            <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{" "}
            <code>CLERK_SECRET_KEY</code> in the Vercel project environment, then redeploy.
          </p>
        </div>
      </div>
    );
  }

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
