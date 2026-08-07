# Hybrid Phase B — Foundations report

Implements additive seams from [`HYBRID_ARCHITECTURE_AUDIT.md`](./HYBRID_ARCHITECTURE_AUDIT.md).

## What changed

| Area | Change |
|------|--------|
| Person | `persons/{personId}` lazy ensure; `personId === clerkUserId` |
| IdentityAccount | Domain view + adapter over `identityLinks` (no rename) |
| Entitlement | `resolvePersonEntitlements` beside org modules; `assertModuleEnabled` still primary gate |
| Policy | `authorizeAction` named actions; used by acceptIncident + request create/assign |
| IncidentAccessGrant | Written on Firestore `acceptIncident` |
| Audit | `auditEvents` helper on request create/assign/status + incident accept |
| Responder | Optional `capabilities[]` + type vocabulary constants |
| Work management | Locked on `operationalRequests` / `workOrders`; vocabulary map docs-only |

## What did not change

- Mobile Home SOS → Express  
- Web Clerk ops session stamping  
- Stored ops status enum values  
- Marketplace / access control / Firebase fallback flag  

## Tests

```bash
npm test --prefix firebase/functions
# hybridArchitecture.test.ts + authorizeAction.test.ts added
```

## Next phase

Phase C — **Done** — see [`HYBRID_PHASE_C.md`](./HYBRID_PHASE_C.md) (Person stamp, entitlement gates, grant-backed post-revoke incident update/location).
