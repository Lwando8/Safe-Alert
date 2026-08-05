# Phase 2B — Test Evidence

**Captured:** 2026-08-05  
**Environment:** Cloud agent VM + Firestore/Auth emulators (`demo-seren`)

## 1. Automated unit/contract suite

Command:

```bash
cd firebase/functions && npm test
```

Result: **44 passed / 0 failed** across:

| File | Focus |
|---|---|
| `membershipMapping.test.ts` | Role → kind/permissions; payload asserts |
| `authPolicy.test.ts` | Tenant match, permissions, platform Firebase reject, fallback flag |
| `tenantIsolation.test.ts` | Incident reads/writes contract, identity fail-closed, push fan-out, UI isolation contract |
| `membershipWebhook.test.ts` | Org upsert, membership CRUD, duplicate, out-of-order, unknown org/user, tenant conflict, signature, missing fields |
| `incidentWrites.test.ts` | Accept/assign/update/close-permission write-path isolation (Phase 2D) |
| `authGuards.test.ts` | Ops/platform route guard contract (Phase 2C) |

## 2. TypeScript build

```bash
cd firebase/functions && npm run build
```

Result: **success**

## 3. Emulator probes (Firebase path)

Emulators: Auth `:9099`, Firestore `:8080`, UI `:4001`

```bash
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren npm run seed:phase2b
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren npm run probe:phase2b
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren npm run probe:phase2d
```

Result: **probe:phase2b 8/8** and **probe:phase2d 10/10** passed

## 4. Clerk probes

**Status: `keys_ready` (2026-08-05 refresh)** — web + functions `pk_test`/`sk_test` present in local gitignored env; `CLERK_WEBHOOK_SECRET` still missing until Functions deploy + Clerk Dashboard webhook.

```bash
cd firebase/functions && npm run preflight:clerk
# → status: keys_ready (exit 1)
```

Previously `externally_blocked` when keys were absent. Live checklist still **not** claimed.

Exact next steps: [`PHASE2-OPERATOR-NEXT-STEPS.md`](./PHASE2-OPERATOR-NEXT-STEPS.md) and `PHASE2B-MANUAL-VERIFICATION-CHECKLIST.md` § Clerk path.

## 5. `/ops/incidents` UI states

Implemented and type-checked in code (Phase 2C tenant boundary remounts on org switch):

- loading / empty / error / unavailable / unauthorized / clerk-unconfigured
- org-switch / sign-out clears tenant state via `OpsTenantBoundary`

Live signed-in UI walkthrough: **blocked on Clerk credentials**.

## 6. Cross-tenant / revocation / push / writes

| Case | Evidence |
|---|---|
| A cannot read B | Emulator probe 2B + unit tests |
| A cannot accept/assign/update B | Emulator probe 2D + `incidentWrites` tests |
| Client org tampering ignored | Probe create-stamp + API ignores query `organizationId` |
| Suspended/revoked membership rejected | Probe 2D + membership loader |
| Push A≠B fan-out | Probe 2B + unit tests |
| Ops/platform separation | `authGuards` tests + middleware |

## 7. CI

`.github/workflows/phase2-functions.yml` — `npm test` + `npm run build` (no Clerk secrets).

## Classification input

Because Firebase emulator paths (2B+2D) are verified and Clerk live path is credential-blocked, overall classification remains **tenant-safe but partially verified**.
