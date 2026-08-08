# Mobile Clerk Auth + Role-Based Experience Routing

**Date:** 2026-08-07  
**Branch:** `mobile/integration-repair`  
**SOS CUTOVER: NO**

## Inventory (Step 1)

One Expo app hosts citizen + responder + admin shells. Legacy `responder-app/` remains frozen. Pre-change auth was Express role-selector + optional Clerk prep (`EXPO_PUBLIC_ENABLE_CLERK_MOBILE` off by default).

## Architecture after this phase

```text
Clerk sign-in
→ session JWT (SecureStore tokenCache)
→ Firebase bridge (issueFirebaseBridgeTokenCallable)
→ resolvePlatformSessionCallable (Person + membership + capabilities)
→ PlatformSession ready
→ experience routing (user | responder)
→ silent Express clerk-compat JWT for SOS only
```

Routing uses membership `kind` / permissions / capabilities / `unitId` — **never email**.

## Enable locally

```bash
EXPO_PUBLIC_ENABLE_CLERK_MOBILE=true
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_EXPRESS_CLERK_COMPAT_SECRET=...   # same as server EXPRESS_CLERK_COMPAT_SECRET
EXPO_PUBLIC_API_BASE_URL=http://<LAN-IP>:4000
```

Restart Metro after changing `.env`. Express loads `server/.env` for the compat secret.

## Deferred

- Remote push / orgDevices live delivery (dev client)
- Responder Firestore work-order parity
- Mobile UI redesign
- Firestore SOS cutover
