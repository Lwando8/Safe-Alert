# Hybrid Phase C — University flow mapping

Maps existing university capabilities onto the hybrid model **without rebuilding features**.

```
Person (personId === Clerk userId)
  → Membership (active | revoked)
  → Organisation (university-a / university-b)
  → Entitlement (PLATFORM SAFETY + ORGANISATION modules)
  → Module (SAFETY / OPERATIONS / …)
```

## What landed

| Flow | Mapping |
|------|---------|
| Firestore `createIncident` / `listOrgIncidents` | Person stamp + `assertUniversityModuleAccess(SAFETY)` |
| `acceptIncident` | Already writes `IncidentAccessGrant` (Phase B) |
| `updateIncidentStatus` / `appendIncidentLocation` | **Grant-aware context** — survives membership revoke when grant active |
| Resolve status | Shrinks grant `validUntil` to grace window |
| `createOperationalRequest` | `reporterPersonId` / `personId` + OPERATIONS entitlement |
| Membership sync | Person ensure + `personId` (Phase B) |

## Explicit non-changes

- Mobile Home SOS → Express (still live)
- No `ALLOW_FIREBASE_AUTH_FALLBACK=false`
- No marketplace / access-control vertical
- Stored ops status enums unchanged

## Grant survival invariant

1. Responder accepts incident → grant written  
2. Membership later revoked → normal context fails  
3. `resolveUniversityIncidentContext` loads grant by `iag_{incidentId}_{personId}`  
4. Update / location append allowed until grant expires  
5. On resolve → grace window then expire  

## Tests

```bash
npm test --prefix firebase/functions
# phaseCUniversity.test.ts + existing hybrid/isolation suites
```

## Next

Phase D — responder capabilities enforcement (maintenance vs security assignment filters).
