'use client';

import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isClerkPublishableConfigured } from '@/lib/auth-guards';
import { Button } from '@/components/ui/button';

/**
 * Public-surface header auth controls.
 * Hidden on /ops and /platform shells (those use ClerkNavControls).
 */
export function RootAuthHeader() {
  const pathname = usePathname();
  if (!isClerkPublishableConfigured()) {
    return null;
  }
  if (pathname.startsWith('/ops') || pathname.startsWith('/platform')) {
    return null;
  }

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border px-6 py-3">
      <Link href="/" className="font-display text-sm font-semibold tracking-tight">
        Seren SOS
      </Link>
      <div className="flex items-center gap-2">
        <Show when="signed-out">
          <SignInButton mode="modal">
            <Button type="button" size="sm" variant="outline">
              Sign in
            </Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <Button type="button" size="sm">
              Sign up
            </Button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <Button render={<Link href="/ops" />} size="sm" variant="outline">
            Open ops
          </Button>
          <UserButton />
        </Show>
      </div>
    </header>
  );
}
