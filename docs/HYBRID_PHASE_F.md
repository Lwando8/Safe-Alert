# Hybrid Phase F — My Services person-first nav

Person-scoped **My Services** hub that lists entitled modules and routes into
**existing** surfaces. Does not rebuild SOS or cut over Express.

```
Person (personId === Clerk userId)
  → active Membership
  → Organisation modules + platform SAFETY
  → Entitlements
  → My Services catalog → Home / Report Issue / Community / …
```

## What landed

| Area | Change |
|------|--------|
| Catalog | `buildMyServicesCatalog` — SAFETY→`home_sos`, OPERATIONS→report/my requests, COMMUNITY*→hub, BROADCASTS→broadcasts |
| Callable | `getMyServicesCallable` — stamps person/org from `RequestContext` |
| Mobile | `MyServicesScreen` + Profile quick action + `getMyServicesMobile()` |
| My requests | Soft-loads `listMyOperationalRequestsMobile` when OPERATIONS entitled |
| Domain | `packages/domain/src/myServices.ts` |

## Navigation (minimal)

- Profile → **My Services** (stack screen)
- Service taps:
  - Emergency SOS → Home tab (existing Express path)
  - Report an issue → `ReportIssue` modal
  - Community / broadcasts → Community tab
  - My requests → inline list on the hub

## Explicit non-changes

- Home SOS → Express unchanged
- No sixth bottom tab (Profile entry only)
- No member web app
- No `ALLOW_FIREBASE_AUTH_FALLBACK=false`
- No marketplace / billing entitlements beyond stubs

## Tests

```bash
npm test --prefix firebase/functions
# phaseFMyServices.test.ts
```

## Next

Phase G — **Done** — see [`HYBRID_PHASE_G.md`](./HYBRID_PHASE_G.md) (non-university packs + RIDE_SAFETY foundation).
