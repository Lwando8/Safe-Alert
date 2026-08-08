# Platform expansion — operator follow-ups

Ordered by importance. Preserves university SOS / incident integrity.

## 1. Deploy & backfill

On a machine with Firebase/GCP auth (this agent cannot):

```bash
# From repo root
npm run firebase:functions:build
npm test --prefix firebase/functions

# Deploy functions + rules + indexes together
npm run firebase:deploy:expansion

# Or separately:
npm run firebase:deploy:functions
npm run firebase:deploy:firestore

# Additive org backfill (safe to re-run)
cd firebase/functions
GCLOUD_PROJECT=seren-sos npm run backfill:tenant-profiles
```

Emulator isolation smoke:

```bash
# Terminal A
firebase emulators:start --only firestore,auth --config firebase/firebase.json --project demo-seren

# Terminal B
cd firebase/functions
npm run seed:phase2b
npm run probe:phase2b
npm run probe:phase2d
npm run probe:expansion
```

## 2. Mobile Firebase bridge (SOS Express unchanged)

Callable: `issueFirebaseBridgeTokenCallable`

| Path | When |
|---|---|
| Existing Firebase Auth | Remint custom token |
| Clerk session (`clerkToken` in callable data) | Create/link `clerk_{userId}` Firebase user + identityLink, mint token |
| `MOBILE_BRIDGE_MINT_SECRET` + `firebaseUid` | Emulator / operator tooling only |

Mobile stores token at AsyncStorage `firebaseCustomToken`. Cleared on sign-out.

Clerk mobile prep remains **off** by default (`PHASE2G-MOBILE-CLERK-PREP.md`).

## 3. Hardened surfaces

- Composite indexes for requests / workOrders / community / broadcasts / analytics
- `/ops/requests` assign + status transitions (Admin SDK, tenant-stamped)
- `notifyOrgEvent` / incident create notify use `sendOrgPushTokens` (Expo Push API + FCM partition) + outbox audit

## 4. Polish

- Ops nav module-gated + terminology labels from org settings
- Seed fixtures for A/B requests, alerts, broadcasts, groups
- `probe:expansion` cross-tenant + privacy checks

## 5. Explicit non-goals (do not build here)

- Access control / visitors / gates / biometrics / CCTV
- Payments / ERP / chat / AI dispatch
- Full tenant provisioning UI
- SOS Express → callable cutover (separate gate)
- Setting `ALLOW_FIREBASE_AUTH_FALLBACK=false` before device Clerk gate

## Related: hybrid architecture

Person-first identity + entitlement foundations:
[`HYBRID_ARCHITECTURE_AUDIT.md`](./HYBRID_ARCHITECTURE_AUDIT.md),
[`HYBRID_PHASE_B.md`](./HYBRID_PHASE_B.md), and
[`HYBRID_PHASE_C.md`](./HYBRID_PHASE_C.md).

- Phase B: additive `Person` / `Entitlement` / `IncidentAccessGrant` seams
- Phase C: university flow mapping — Person stamps, entitlement module gates,
  grant-backed incident update/location after membership revoke
- Phase D: responder capability filters — INCIDENT_RESPONSE for SOS assign/accept;
  category-matched maintenance capabilities for ops assign (teams stay separate)
- Phase E: maintenance UX — SLA targets by priority + team picker on `/ops/requests`
- Phase F: person-first My Services hub (Profile → catalog → existing Home/Report/Community)
- Phase G: non-university profile packs + RIDE_SAFETY create/list foundation

Does **not** rewrite SOS Express or merge maintenance into emergency incidents.
