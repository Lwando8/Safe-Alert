# Phase 2B — Implementation Notes

**Branch:** `cursor/phase-2b-tenant-backend-8d10`  
**Date:** 2026-08-05  
**Scope:** Tenant-scope backend + wire `/ops/incidents` + automated isolation tests

## Pre-edit gap inventory

| Surface | Status before this task | Status after |
|---|---|---|
| `resolveRequestContext` / dual-auth | Complete | Complete (unchanged contract) |
| Clerk JWT verification | Complete | Complete |
| Firebase legacy adapter | Complete | Complete |
| Identity links | Complete | Covered by tests |
| Membership loader (active only) | Complete | Covered by tests |
| Incident repositories | Inline helpers only | `tenantIncidentService` extracted |
| Push token registration | Migrated | Scoped + tested |
| `createIncident` | Migrated | Uses tenant service |
| `getNearbyIncidents` | Migrated | Uses tenant list helper |
| `acceptIncident` / status / assign | Migrated | Unchanged lifecycle |
| `registerPushToken` | Migrated | Adds installation/environment |
| `listOrgIncidents` | Missing | Added for ops list |
| `/ops/incidents` UI | Placeholder | Wired to tenant-scoped backend |
| Webhook membership sync | Code complete | Idempotent receipts + tests |
| Automated isolation tests | Smoke only | Vitest suite + emulator probe |
| Audit | Timeline `authProvider` only | Unchanged (no Phase 6 audit UI) |

### Still unmigrated (out of Phase 2B stop-gate slice)

- `registerCitizen`, `loginResponder`, `loginAdmin`, `resolveDeviceAccess`
- `startShift`, `endShift`, `unitHeartbeat`, `legacyApiProxy`
- Client Firestore rules still role-based (Admin SDK callables enforce tenant)
- Mobile still on Firebase Auth (bridge required)

## What this task delivered

1. **`/ops/incidents`** loads real tenant-scoped incidents via Clerk session + Firestore membership (same permission rule as callables: `incidents:read-all`). Client `organizationId` query params are ignored.
2. **Shared `tenantIncidentService`** for create/list/push used by callables.
3. **Webhook hardening:** Svix receipt idempotency, `organization.updated`, fail-closed missing fields, preserve suspended/revoked on update, tenant ID conflict detection.
4. **Automated tests** (33) + **emulator probe** (8/8) for University A/B isolation.
5. **Docs:** dual-auth bridge update, tenant inventory update, evidence, checklist, stop-gate report.

## Architecture for ops incidents

```
Clerk session (org slug)
    → Firestore memberships (active + permissions)
    → incidents where organizationId == membership.organizationId
```

This mirrors callable `listOrgIncidents` / `getNearbyIncidents` authorization. It does **not** invent a second permission model.

Firebase Auth fallback is **not** used for `/ops/*` or `/platform/*` web routes.
