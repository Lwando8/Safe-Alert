# Phase 2C — Ops / Platform Hardening

**Date:** 2026-08-05  
**Status:** Implemented (Clerk live matrix still credential-gated)

## What changed

### Route guards

- Shared policy in [`apps/web/src/lib/auth-guards.ts`](../apps/web/src/lib/auth-guards.ts)
- [`apps/web/src/middleware.ts`](../apps/web/src/middleware.ts) uses `resolveProtectedRouteRedirect`
- Platform soft-guard: [`apps/web/src/components/platform-admin-gate.tsx`](../apps/web/src/components/platform-admin-gate.tsx)
- `/platform/organizations` remains a **shell** (no provisioning)

### Tenant boundary (org-switch / sign-out)

- [`apps/web/src/components/ops-tenant-boundary.tsx`](../apps/web/src/components/ops-tenant-boundary.tsx) wraps university ops layout
- Bumps `tenantEpoch` and remounts children on org change / sign-out
- `/ops/incidents` consumes `useOpsTenantBoundary` (no second cache model)

### Web vs Firebase fallback

Web `/ops` and `/platform` never use Firebase Auth fallback — Clerk session only.

## Regression checklist

| Case | Expected |
|---|---|
| Non-`platformAdmin` → `/platform` | `/unauthorized` (middleware) + soft-guard empty state |
| Signed-in, no org → `/ops` | `/select-organization` |
| Org switch on any ops page | children remount (`data-tenant-epoch` increments) |
| Sign-out | incidents cleared; ops tree remounts with `signed_out` key |
| Organizations page | still placeholder shell |

## Verify

```bash
cd firebase/functions && npm test   # includes authGuards contract tests
# With Clerk keys: walk checklist in PHASE2B-MANUAL-VERIFICATION-CHECKLIST.md
```
