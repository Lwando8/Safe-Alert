"use client";

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

type ClerkNavControlsProps = {
  variant?: "university" | "platform";
};

function clerkPublishableKeyConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
  return key.startsWith("pk_") && !key.includes("your_key");
}

export function ClerkNavControls({
  variant = "university",
}: ClerkNavControlsProps) {
  if (!clerkPublishableKeyConfigured()) {
    return (
      <p className="text-xs text-muted-foreground">
        Clerk keys not configured — auth UI disabled
      </p>
    );
  }

  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <OrganizationSwitcher
        hidePersonal={variant === "university"}
        afterSelectOrganizationUrl="/ops"
        afterCreateOrganizationUrl="/ops"
        appearance={{
          elements: {
            rootBox: "flex-1",
            organizationSwitcherTrigger: cn(
              "border rounded-md px-3 py-2 text-sm w-full justify-start",
              variant === "platform"
                ? "border-white/20 hover:bg-white/10"
                : "border-border hover:bg-accent",
            ),
          },
        }}
      />
      <UserButton
        appearance={{
          elements: {
            userButtonBox: "scale-110",
          },
        }}
      />
    </div>
  );
}
