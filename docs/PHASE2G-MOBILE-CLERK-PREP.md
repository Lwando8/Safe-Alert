# Phase 2G — Mobile Clerk cutover prep (code only)

**Status:** Prep wired; **default path remains legacy API / Firebase fallback**.

## Invariants

- Do **not** set `ALLOW_FIREBASE_AUTH_FALLBACK=false` until physical iOS/Android Clerk auth + push registration pass.
- Do **not** enable `EXPO_PUBLIC_ENABLE_CLERK_MOBILE` in production builds yet.
- Web `/ops` and `/platform` stay Clerk-only (unchanged).

## Code added

| File | Role |
|---|---|
| `src/auth/clerkMobileConfig.ts` | Feature flag + publishable key helpers |
| `src/auth/ClerkMobilePrepBoundary.tsx` | No-op by default; mounts `@clerk/expo` ClerkProvider only when flag+key present |
| `App.tsx` | Wraps tree with prep boundary (legacy when flag off) |

## Enable locally (dev only)

```bash
# app env / eas secrets — never commit real keys
EXPO_PUBLIC_ENABLE_CLERK_MOBILE=true
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

## Removal gate (later)

1. Device Clerk sign-in for student + responder flows
2. Push token registration under orgDevices
3. No production sessions depending on Firebase-only claims without identityLinks
4. Then set functions `ALLOW_FIREBASE_AUTH_FALLBACK=false` and redeploy
