import { OrganizationList } from "@clerk/nextjs";
import Link from "next/link";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { isClerkConfigured, readPlatformAdminFlag } from "@/lib/auth-guards";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/**
 * University membership picker.
 * Normal users JOIN an existing university — they do not self-create tenants.
 * Platform admins can skip to /platform (org not required for that surface).
 */
export default async function SelectOrganizationPage() {
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
            <code>CLERK_SECRET_KEY</code> in the Vercel project environment, then
            redeploy.
          </p>
        </div>
      </div>
    );
  }

  const session = await auth();
  let isPlatformAdmin = readPlatformAdminFlag(session.sessionClaims);
  if (!isPlatformAdmin && session.userId) {
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(session.userId);
      isPlatformAdmin = readPlatformAdminFlag({
        publicMetadata: user.publicMetadata,
      });
    } catch {
      // keep false
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
            Select your university
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            University operations require an active membership. New campuses are
            provisioned by Seren platform admins — not by self-serve signup.
          </p>
        </div>

        {isPlatformAdmin ? (
          <div className="mb-6 rounded-md border border-border bg-card p-4 text-sm">
            <p className="font-medium text-foreground">Platform admin</p>
            <p className="mt-1 text-muted-foreground">
              You can open the Seren platform console without selecting a
              university. Campus membership is only required for /ops.
            </p>
            <Button className="mt-3" render={<Link href="/platform" />}>
              Go to platform console
            </Button>
          </div>
        ) : null}

        <OrganizationList
          hidePersonal
          // Invite/membership only — do not offer create-org in the product UI.
          // Clerk also respects user.create_organization_enabled=false.
          skipInvitationScreen
          afterSelectOrganizationUrl="/ops"
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-lg border border-border bg-card",
            },
          }}
        />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          No university listed? Ask your campus safety admin for an invite, or
          contact Seren support. Creating a new organization from this screen is
          disabled.
        </p>
      </div>
    </div>
  );
}
