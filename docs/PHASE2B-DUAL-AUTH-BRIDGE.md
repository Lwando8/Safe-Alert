# Phase 2B — Dual-Auth Bridge (Temporary Technical Debt)

**Status:** Active during Phase 2B  
**Stop-gate classification after 2B:** **partially verified** (not yet tenant-safe for multi-university production)

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
8. No Firebase fallback on `/platform/*` or platform callables (`linkIdentity`, Clerk-required bootstrap).
9. One authorization policy — no separate Clerk vs Firebase permission trees.

## Migrated callables (bridge surface)

- `createIncident`
- `getNearbyIncidents`
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

- HTTP: `clerkWebhook` (Svix-verified) → `MembershipSyncService`
- Callable: `bootstrapOrganizationMemberships` (platform operator **or** `MEMBERSHIP_BOOTSTRAP_SECRET`)

## Removal gate (delete Firebase fallback only when ALL are true)

1. Mobile application authenticates with Clerk (not Firebase ID tokens for incident/push APIs).
2. Physical-device incident creation and push registration pass on **iOS and Android**.
3. No production Firebase-authenticated sessions remain on the migrated surface.

Until then, treat the bridge as **temporary debt**. After removal: set `ALLOW_FIREBASE_AUTH_FALLBACK=false`, delete `firebaseLegacyAdapter` usage, and re-run cross-tenant verification (Phase 2D).

## Smoke

```bash
cd firebase/functions
SMOKE_CHECKLIST_ONLY=1 npx ts-node scripts/phase2b-smoke.ts   # print matrix
npm run build && node -e "require('./lib/scripts/phase2b-smoke.js')"  # local policy asserts
```

Core smoke: **University A must not read University B incidents.**

## After 2B

- **2C** — harden `/ops` vs `/platform`, clear caches on org switch  
- **2D** — automated cross-tenant tests  
- **Stop-gate** — promote from **partially verified** → **tenant-safe** only after bridge removal + 2D
