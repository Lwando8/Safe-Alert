'use client';

import {
  OrganizationSwitcher,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from '@clerk/nextjs';
import { cn } from '@/lib/utils';
import { isClerkPublishableConfigured } from '@/lib/auth-guards';
import { Button } from '@/components/ui/button';

type ClerkNavControlsProps = {
  variant?: 'university' | 'platform';
};

/**
 * Ops/platform shell auth controls.
 * Uses <Show> (not deprecated SignedIn/SignedOut).
 */
export function ClerkNavControls({
  variant = 'university',
}: ClerkNavControlsProps) {
  if (!isClerkPublishableConfigured()) {
    return (
      <p className="text-xs text-muted-foreground">
        Clerk keys not configured — auth UI disabled
      </p>
    );
  }

  return (
    <div className="mb-3 flex flex-col gap-2">
      <Show when="signed-out">
        <div className="flex gap-2">
          <SignInButton mode="modal">
            <Button type="button" size="sm" className="flex-1">
              Sign in
            </Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button type="button" size="sm" variant="outline" className="flex-1">
              Sign up
            </Button>
          </SignUpButton>
        </div>
      </Show>
      <Show when="signed-in">
        <div className="flex items-center justify-between gap-2">
          <OrganizationSwitcher
            hidePersonal={variant === 'university'}
            afterSelectOrganizationUrl="/ops"
            appearance={{
              elements: {
                rootBox: 'flex-1',
                organizationSwitcherTrigger: cn(
                  'border rounded-md px-3 py-2 text-sm w-full justify-start',
                  variant === 'platform'
                    ? 'border-white/20 hover:bg-white/10'
                    : 'border-border hover:bg-accent',
                ),
              },
            }}
          />
          <UserButton
            appearance={{
              elements: {
                userButtonBox: 'scale-110',
              },
            }}
          />
        </div>
      </Show>
    </div>
  );
}
