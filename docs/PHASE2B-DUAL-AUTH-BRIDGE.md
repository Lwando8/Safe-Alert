# Phase 2B — Dual-Auth Bridge (Temporary Technical Debt)

**Status:** Active during Phase 2B  
**Stop-gate classification after this verification slice:** **tenant-safe but partially verified**

## Purpose

Keep the live mobile Firebase Auth path working while making the **server** the source of truth for `organizationId`. Clerk is preferred; Firebase is an explicit legacy adapter into the **same** `RequestContext` + `authorize()` pipeline.

## Locked rules

1. One canonical `RequestContext` (`authProvider: "clerk" | "firebase"`).
2. Clerk JWT attempted first; Firebase ID token only via `firebaseLegacyAdapter`.
3. Never trust client-supplied `organizationId`, roles, or permissions.
4. Membership status and permissions come from Firestore `memberships/{id}` (active only).
5. Fail closed on missing / duplicate / conflicting `identityLinks`.
6. Feature flag: `ALLOW_FIREBASE_AUTH_FALLBACK` (default `true` in 2B).
7. Fallback limited to migrated callables (incidents + push token).
8. No Firebase fallback on `/platform/*`, platform callables (`linkIdentity`, Clerk-required bootstrap), or web `/ops/*` (Clerk session).
9. One authorization policy — no separate Clerk vs Firebase permission trees.

## Migrated callables (bridge surface)

- `createIncident`
- `getNearbyIncidents`
- `listOrgIncidents` (ops list; same tenant pipeline)
- `appendIncidentLocation`
- `acceptIncident`
- `updateIncidentStatus`
- `assignUnitToIncident`
- `registerPushToken`
- Trigger: `onIncidentCreatedNotify` (org-scoped via `orgDevices/{organizationId}/tokens`)

## Identity mapping

Collection: `identityLinks/{id}`

| Field | Meaning |
|-------|---------|
| `userId` / `clerkUserId` | Canonical Clerk user id |
| `firebaseUid` | Firebase Auth uid |
| `status` | `active` \| `revoked` |

Exactly one active link per `firebaseUid` and per `clerkUserId`. Conflicts → deny.

## Membership sync

- HTTP: `clerkWebhook` (Svix-verified, idempotent `webhookReceipts/{svix-id}`) → `MembershipSyncService`
- Events: `organizationMembership.created|updated|deleted`, `organization.created|updated`
- Callable: `bootstrapOrganizationMemberships` (platform operator **or** `MEMBERSHIP_BOOTSTRAP_SECRET`)

## `/ops/incidents`

Uses Clerk session + active membership + `incidents:read-all`, then queries Firestore with **membership** `organizationId` only. Same authorization semantics as `listOrgIncidents`.

## Removal gate (delete Firebase fallback only when ALL are true)

> Remove Firebase authentication fallback only after the mobile application authenticates with Clerk, physical-device incident creation and push registration pass on iOS and Android, and no production Firebase-authenticated sessions remain.

Until then, treat the bridge as **temporary debt**. After removal: set `ALLOW_FIREBASE_AUTH_FALLBACK=false`, delete `firebaseLegacyAdapter` usage, and re-run cross-tenant verification (Phase 2D).

## Smoke / tests

```bash
cd firebase/functions
npm test
npm run smoke:phase2b
# With emulators:
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren npm run seed:phase2b
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren npm run probe:phase2b
```

Core smoke: **University A must not read University B incidents.**

## After 2B

- **2C** — harden `/ops` vs `/platform`, clear caches on org switch (partially addressed in incidents UI)
- **2D** — expand automated suite / live Clerk CI
- **Stop-gate** — promote to **tenant-safe and verified** only after bridge removal gate + live Clerk probes
