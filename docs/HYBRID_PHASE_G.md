# Hybrid Phase G — Additional verticals

Non-university **tenant profile packaging** + **RIDE_SAFETY foundation**.
Does not build marketplace (Phase H), access control, or Express SOS cutover.

```
TenantProfile (UNIVERSITY | RESIDENTIAL | BUSINESS_PARK | …)
  → applyTenantProfilePack (modules + terminology + categories)
  → Entitlements / My Services / Ops nav
  → RIDE_SAFETY module (create/list stubs only)
```

## What landed

| Area | Change |
|------|--------|
| Profile pack | `applyTenantProfilePack` — restamp defaults when `tenantProfile` changes |
| Platform update | Callable + web platform org editor apply pack on profile change |
| Ops presentation | Profile-aware `resolveEffectiveModules` / terminology (no hard-coded UNIVERSITY ride=on) |
| RIDE_SAFETY | Domain types + `rideSafetyRequests` collection + create/list callables |
| My Services | `svc_ride_safety` + terminology relabel for ops rows |
| Ops UI | Module-gated `/ops/ride-safety` foundation stub |
| Seed | `npm run seed:phase-g` → `residential-a`, `student-residence-a`, ride fixture |

## Explicit non-changes

- Express SOS Home path
- No trip matching / live escort dispatch product
- No marketplace / billing
- No visitors / gates / access control
- Clerk membership bootstrap still defaults new orgs to UNIVERSITY

## Tests

```bash
npm test --prefix firebase/functions
# phaseGVerticals.test.ts
npm run seed:phase-g --prefix firebase/functions   # emulator
```

## Next

Phase H — marketplace / billing (later).
