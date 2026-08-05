'use client';

import { Show, SignInButton, SignUpButton } from '@clerk/nextjs';
import { isClerkPublishableConfigured } from '@/lib/auth-guards';
import { Button } from '@/components/ui/button';

export function HomeAuthCtas() {
  if (!isClerkPublishableConfigured()) {
    return (
      <p className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        Clerk keys are not configured. Add <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{' '}
        <code>CLERK_SECRET_KEY</code> to <code>apps/web/.env.local</code>, then restart the
        dev server.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <Button type="button">Sign in</Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button type="button" variant="outline">
            Create account
          </Button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <p className="text-sm text-muted-foreground">
          You are signed in — use the profile button in the header, then open University
          operations.
        </p>
      </Show>
    </div>
  );
}
