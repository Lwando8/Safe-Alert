# Phase 2B — Stop-Gate Report

**Date:** 2026-08-05  
**Branch:** `cursor/phase-2b-tenant-backend-8d10`

## 1. Executive summary

**Classification: `tenant-safe but partially verified`**

Phase 2B migrated incident/push APIs and `/ops/incidents`; Phase 2C hardened `/ops` vs `/platform` and added ops tenant-boundary remount; Phase 2D expanded automated write-path isolation (`probe:phase2d` 10/10, vitest 44/44). Clerk live authentication and physical-device paths are not verified in this environment (`preflight:clerk` → externally_blocked).

## 2. Code changes (high level)

| Area | Change |
|---|---|
| Tenant incident service + callables | 2B shared helpers / `listOrgIncidents` |
| Membership sync + webhook | Idempotent receipts |
| `/ops/incidents` | Tenant-scoped backend |
| Auth guards + platform soft-gate | Phase 2C |
| Ops tenant boundary | Org-switch/sign-out remount |
| `probe:phase2d` + write tests + CI | Phase 2D |
| Docs | 2B/2C/2D evidence and checklists |

## 3. Tenant enforcement

- **Context resolution:** Clerk JWT preferred → active Firestore membership → `RequestContext`. Firebase ID token only via `firebaseLegacyAdapter` + `identityLinks` when `ALLOW_FIREBASE_AUTH_FALLBACK` enabled.
- **Identity mapping:** Canonical `userId === clerkUserId`; fail closed on missing/duplicate/conflict.
- **Permissions:** `authorize` / `authorizeAnyPermission` on membership permissions; platform operator Clerk-only.
- **Client org tampering:** Ignored on callables and ops API; stamps/filters use `context.organizationId` / membership org only.
- **Firebase fallback allowed:** Migrated incident/push callables when flag enabled and no usable Clerk token.
- **Firebase fallback prohibited:** `/platform/*`, `linkIdentity`, Clerk-required bootstrap, web ops (Clerk session).

## 4. UI integration

`/ops/incidents` uses the real backend. Phase 2C `OpsTenantBoundary` remounts all ops children on org switch/sign-out. Live Clerk UI probe externally blocked.

## 5. Verification evidence

- Tests: **44/44 passed**
- Emulator probes: **2B 8/8**, **2D 10/10**
- Clerk probes: **externally blocked** (`preflight:clerk`)
- CI: `.github/workflows/phase2-functions.yml`
- See `PHASE2B-TEST-EVIDENCE.md`, `PHASE2C-OPS-PLATFORM-HARDENING.md`, `PHASE2D-ISOLATION-TESTS.md`

## 6. Remaining blockers

| Type | Items |
|---|---|
| Code | Unmigrated callables (login/shift/heartbeat); client Firestore rules not org-filtered; geo radius not applied in `getNearbyIncidents` |
| Configuration | Clerk webhook dashboard URL/secret; operator bootstrap of live orgs |
| External credentials | Clerk `pk_`/`sk_` absent in this VM |
| Physical device | iOS/Android Clerk auth + push registration not run |

## 7. Stop-gate decisions

| Question | Answer |
|---|---|
| Safe to create a **second test university** (emulator/Clerk test)? | **Yes** — fixtures and probes already use University A/B |
| Safe to onboard a **second production university**? | **No** — Clerk live path + mobile bridge removal gate unmet; rules still global for client reads |
| Any code path still unscoped? | **Yes** — unmigrated callables, RTDB live units/tracks client rules, legacy login helpers |
| Is Firebase fallback still required? | **Yes** — mobile still Firebase-authenticated |
| Exact condition to begin Phase 3? | Phase 2B→2D complete **and** fallback removal gate met (below) **and** stop-gate promoted to tenant-safe and verified for the surfaces being productized |

### Firebase fallback removal gate (mandatory statement)

> Remove Firebase authentication fallback only after the mobile application authenticates with Clerk, physical-device incident creation and push registration pass on iOS and Android, and no production Firebase-authenticated sessions remain.

Until that gate is met, keep `ALLOW_FIREBASE_AUTH_FALLBACK` enabled for migrated mobile callables and treat dual-auth as temporary debt.
