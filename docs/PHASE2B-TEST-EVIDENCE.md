# Phase 2B — Test Evidence

**Captured:** 2026-08-05  
**Environment:** Cloud agent VM + Firestore/Auth emulators (`demo-seren`)

## 1. Automated unit/contract suite

Command:

```bash
cd firebase/functions && npm test
```

Result: **33 passed / 0 failed** across:

| File | Focus |
|---|---|
| `membershipMapping.test.ts` | Role → kind/permissions; payload asserts |
| `authPolicy.test.ts` | Tenant match, permissions, platform Firebase reject, fallback flag |
| `tenantIsolation.test.ts` | Incident reads/writes contract, identity fail-closed, push fan-out, UI isolation contract |
| `membershipWebhook.test.ts` | Org upsert, membership CRUD, duplicate, out-of-order, unknown org/user, tenant conflict, signature, missing fields |

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
```

Result: **8/8 passed**

| Probe | Result |
|---|---|
| create-stamp (server org, ignore client spoof) | PASS |
| read-a (A sees A, not B fixture) | PASS |
| cross-tenant-read (B cannot see A probe) | PASS |
| cross-tenant-write-guard | PASS |
| permission-deny | PASS |
| suspended-membership | PASS |
| push-isolation | PASS |
| fallback-disable | PASS |

## 4. Clerk probes

**Status: externally blocked** — no `pk_`/`sk_` Clerk secrets in this environment (`apps/web/.env.local` absent).

Exact steps to complete: see `PHASE2B-MANUAL-VERIFICATION-CHECKLIST.md` § Clerk path.

## 5. `/ops/incidents` UI states

Implemented and type-checked in code:

- loading
- empty
- error / unavailable
- unauthorized / no membership / permission denied
- clerk unconfigured
- org-switch / sign-out clears tenant state

Live signed-in UI walkthrough: **blocked on Clerk credentials**.

## 6. Cross-tenant / revocation / push

| Case | Evidence |
|---|---|
| A cannot read B | Emulator probe + unit tests |
| Client org tampering ignored | Probe `create-stamp` + API ignores query `organizationId` |
| Suspended membership rejected | Probe + membership loader tests |
| Push A≠B fan-out | Probe + unit tests |

## Classification input

Because Firebase emulator path is verified and Clerk live path is credential-blocked, overall Phase 2B classification is **tenant-safe but partially verified**.
