# Hybrid Phase D — Responder capabilities enforcement

Enforces **security vs maintenance** assignment filters using additive `capabilities[]`
(with defaults derived from `responderType` / membership `kind` / team `kind`).

```
Emergency Incident  → requires INCIDENT_RESPONSE
Operational Request → requires category-matched maintenance capability
```

Maintenance stays on `operationalRequests` / `workOrders` / `teams`.
Facilities work is **not** forced onto `responderUnits` SOS units.

## What landed

| Surface | Enforcement |
|---------|-------------|
| `getNearbyIncidents` (unit list) | `canAssign` from `canRespondToIncident` (not always `true`) |
| `assignUnitToIncident` | Rejects units lacking `INCIDENT_RESPONSE` |
| `acceptIncident` | Same capability gate on bound unit / membership kind |
| `assignOperationalRequest` | Assignee membership or team must match request category |
| Seed | Explicit caps on security units; `unit_a_maint` + `team_a_facilities` fixtures |
| Domain | `packages/domain/src/responderCapabilities.ts` |

## Defaults (legacy-safe)

| Type / kind | Default capabilities |
|-------------|----------------------|
| `campus_security` / SECURITY / police aliases | `INCIDENT_RESPONSE`, `PATROL` |
| MEDICAL / FIRE | `INCIDENT_RESPONSE` (+ PATROL for FIRE) |
| MAINTENANCE / FACILITIES | `GENERAL_MAINTENANCE` |
| membership `facilities` | broad maintenance set |
| membership `security_guard` | incident response |

Explicit `capabilities[]` always wins over defaults.

## Explicit non-changes

- Express SOS marketplace / `unitMatchesIncidentType` untouched
- No merge of ops requests into emergency `Incident`
- No `ALLOW_FIREBASE_AUTH_FALLBACK=false`
- Incident assignment status machine semantics unchanged

## Tests

```bash
npm test --prefix firebase/functions
# phaseDCapabilities.test.ts
```

## Next

Phase E — maintenance UX deepen (SLA, team picker).
