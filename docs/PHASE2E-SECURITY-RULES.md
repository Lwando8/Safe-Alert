# Phase 2E — Client security rules hardening

**Date:** 2026-08-05  
**Branch:** `cursor/phase-2b-tenant-backend-8d10`  
**Depends on:** Phase 2B–2D (callable/Admin tenant enforcement)  
**Does not require:** Blaze / Cloud Functions deploy

## Why

Phase 2B–2D enforce tenant isolation in **Cloud Functions** and **web Admin SDK** paths. Client Firestore/RTDB rules still allowed role-based reads that were **cross-tenant** (any `DISPATCHER` / `RESPONDER_UNIT` could read all orgs’ incidents/units).

Billing/Blaze is blocked for Functions deploy; rules can still advance tenant safety on Spark.

## Posture

**Deny client SDK access** to tenant-sensitive data. Allowed writers/readers:

| Surface | Access |
|---|---|
| `apps/web` ops/platform | Firebase **Admin SDK** (server) |
| Migrated incident/push APIs | Cloud **Functions** (Admin) |
| Unmigrated callables | Cloud **Functions** (Admin) — still deploy-gated |
| Mobile/client Firestore & RTDB | **Denied** until Clerk org claims + intentional client surfaces |

## Changes

### `firebase/firestore.rules`

- `incidents` (+ timeline), `responderUnits`, `shifts`, `operationalDevices`, `fcmTokens` → `allow read, write: if false`
- Keep Admin-only: `memberships`, `identityLinks`, `organizations`, `sites`, `orgDevices`
- Explicit deny: `webhookReceipts`, `admins`
- Default deny catch-all: `match /{document=**}`
- Preserve self-scoped `users/{uid}` profile/contacts/medical reads (and self-writes on contacts/medical)

### `firebase/database.rules.json`

- Remove root `auth != null` open read/write
- `liveUnits` / `incidentTracks` → client deny (Admin/Functions only)

## Deploy (Spark-compatible)

```bash
cd firebase
../node_modules/.bin/firebase deploy --only firestore:rules,database --project seren-sos
```

Functions / Secret Manager / Cloud Run still need **Blaze** (deferred).

## Follow-ons (not in 2E)

- Re-open selective client reads only with verified `request.auth.token.organizationId` (or Clerk session → custom claims)
- Nest RTDB under `{organizationId}/…` when writers are updated
- Mobile Clerk cutover / `ALLOW_FIREBASE_AUTH_FALLBACK=false`
- Migrate remaining callables; Functions deploy when Blaze is available
