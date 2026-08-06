'use client';

import { useAuth, useUser } from '@clerk/nextjs';
import Link from 'next/link';
import {
  isClerkPublishableConfigured,
  isPlatformAdmin,
  readPlatformAdminFlag,
} from '@/lib/auth-guards';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/**
 * Defense-in-depth soft guard for /platform.
 * Middleware remains the source of truth; this avoids rendering platform chrome
 * content if claims are missing when Clerk is configured.
 *
 * Client-side only checks the publishable key (secret is server-only).
 */
export function PlatformAdminGate({ children }: { children: React.ReactNode }) {
  if (!isClerkPublishableConfigured()) {
    return <>{children}</>;
  }

  return <PlatformAdminGateAuthed>{children}</PlatformAdminGateAuthed>;
}

function PlatformAdminGateAuthed({ children }: { children: React.ReactNode }) {
  const { isLoaded, userId, sessionClaims } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();

  if (!isLoaded || !userLoaded) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-8">
        <p className="text-sm text-muted-foreground">Checking platform access…</p>
      </main>
    );
  }

  const allowed =
    isPlatformAdmin({
      userId,
      orgId: null,
      sessionClaims: sessionClaims as Record<string, unknown> | null,
    }) || readPlatformAdminFlag({ publicMetadata: user?.publicMetadata });

  if (!allowed) {
    return (
      <main className="flex flex-1 flex-col gap-4 p-8">
        <Card>
          <CardHeader>
            <CardTitle>Unauthorized</CardTitle>
            <CardDescription>
              Platform routes require Clerk platformAdmin metadata. Firebase
              authentication fallback is never used on /platform.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="text-sm text-primary underline" href="/unauthorized">
              Go to unauthorized
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return <>{children}</>;
}
