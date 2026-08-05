# Phase 2D — Isolation Tests

**Date:** 2026-08-05  
**Status:** Automated write-path isolation expanded (Clerk live still blocked without keys)

## Scope

Deepen automated proof for migrated incident **write** surfaces without inventing `closeIncident` lifecycle:

- `acceptIncident` (acknowledge/update permission + tenant load)
- `assignUnitToIncident` (assign permission + unit org match)
- `updateIncidentStatus` (update permission + tenant load)
- `incidents:close` **permission gating only**

## Commands

```bash
cd firebase/functions
npm test
npm run build

# Emulators
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren npm run seed:phase2b
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren npm run probe:phase2b
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren npm run probe:phase2d
```

## CI

[`.github/workflows/phase2-functions.yml`](../.github/workflows/phase2-functions.yml) runs `npm test` + `npm run build` on PRs. Emulator probes remain local/manual evidence (no Clerk secrets in CI).

## Probe cases (`probe:phase2d`)

| ID | Intent |
|---|---|
| `cross-tenant-accept` | A cannot load B incident |
| `cross-tenant-update` | A cannot load B for update |
| `cross-tenant-assign-unit` | A cannot use B responder unit |
| `perm-assign-deny` | student cannot assign |
| `perm-close-deny` / `perm-close-allow-supervisor` | close permission gated |
| `same-tenant-accept-guard` | A can acknowledge A |
| `suspended-reject` / `revoked-reject` | inactive memberships fail closed |
| `create-server-stamp` | server org stamp ignores client hint |

## Stop-gate note

Phase 2D strengthens automated proof for migrated surfaces. Classification remains **tenant-safe but partially verified** until Clerk live probes + mobile Firebase fallback removal gate are met.
