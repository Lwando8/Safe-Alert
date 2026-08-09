# Mobile Integration Repair — Runtime Architecture

**Branch:** `mobile/integration-repair`  
**Date:** 2026-08-08  
**Phase:** Mobile integration repair + cross-client convergence (not a domain rewrite)

### Canonical Clerk application

**Seren SOS** (`real-guppy-12`) — publishable/secret keys for mobile Expo and ops web.  
**Not** Seren SOS Platform (`expert-drake-16`).

### One-command device labs

Shared helpers: `scripts/lab-lib.sh`.  
**Avoid Expo `--tunnel` for bridge testing** — tunnel only carries the JS bundle; Functions/Auth stay unreachable unless also exposed.

| Command | When | What it does |
|---------|------|----------------|
| `npm run lab` / `npm run lab:lan` | Physical iPhone, or Android on same Wi‑Fi | Detects LAN IP → writes `.env.local` hosts → Express + emulators → `seed:phase2b` → optional Clerk membership → Expo `--lan` |
| `npm run lab:usb` | Android USB debugging | Applies `.env.local.usb` → `adb reverse` → same stack → Expo `--localhost` |

```bash
# iPhone / LAN (preferred when no USB reverse)
npm run lab
npm run lab -- --seed-clerk-user user_xxx
LAB_LAN_IP=192.168.0.90 npm run lab -- --clear

# Android USB
npm run lab:usb
npm run lab:usb -- --seed-clerk-user user_xxx
```

Templates: `.env.local.lan`, `.env.local.usb`. Do **not** mix USB `.env.local` (`127.0.0.1`) with a physical iPhone — Expo will report “cannot connect to the server”.

After every emulator restart, data is wiped — the lab scripts re-run `seed:phase2b`; pass `--seed-clerk-user` for the real Clerk `user_…` membership.

### Platform organization provision

Platform admin → **Organizations**:

- **Create organization** — name + slug + tenant profile.  
  - **Lab** — Firestore org + `{slug}_main` site with synthetic `org_clerk_*` (requires `FIRESTORE_EMULATOR_HOST`).  
  - **Live** — create Clerk organization (or link an existing `org_…`) then Firestore + default site.  
- **Link Clerk org** (org detail) — attach a live `org_…` to an existing Firestore tenant so Sync/Invite use the live path.

### Platform member attach (preferred over hand-seed for students)

Platform admin → **Organizations → [org] → Members**:

- **Attach** — existing Clerk `user_…` or email → Firestore membership (and Clerk org membership when live).  
- **Invite** — new email: live org sends Clerk organization invitation; lab/emulator creates Clerk user + Firestore membership (temporary password shown once). Existing emails fall through to Attach.  
- **Provision responder** — existing Clerk user → `responderUnits` + membership with unit/capabilities (`security` | `facilities` | `hybrid`). Live orgs also create/update Clerk org membership (`org:responder` / `org:facilities`). Facilities/hybrid seed a lab work order when `FIRESTORE_EMULATOR_HOST` is set. Preferred over `--seed-clerk-user` with `SEED_ROLE=responder`.  
- **Sync from Clerk** — live orgs only; pulls full Clerk membership list into Firestore after drift/missed webhooks.  

Actor needs `public_metadata.platformAdmin=true`. Web must use Seren SOS keys and point Admin SDK at the emulator for lab.

---

## Current runtime

| Surface | Authoritative path today |
|---------|--------------------------|
| **Ops / platform web** | Clerk + Firestore/Functions (`seren-sos` when deployed; emulator `demo-seren`) |
| **User mobile SOS** | Firestore `createIncident` / `appendIncidentLocation` (via platform bridge) |
| **User mobile Report / Community / My Services** | Firebase callables after **platform bridge** |
| **Responder mobile emergency** | Firestore `getNearbyIncidents` / `acceptIncident` / `updateIncidentStatus` (+ soft-shift for Clerk units) |
| **Responder mobile work orders** | Firestore callables (`listMyWorkOrdersCallable` / `updateWorkOrderStatusCallable`) |
| **Standalone `responder-app/`** | **Legacy duplicate** — Express-only; do not extend |
| **Express `/alerts`** | Legacy regression only (`scripts/express-sos-regression.js`) — not used by root Expo SOS |

### Canonical responder app

**Canonical:** root Expo app role `responder` (`src/screens/responder/`).  
**Legacy:** `responder-app/` — freeze; remove only after explicit verification that no store/build pipeline depends on it.

---

## Migration direction

| Concern | Today | Transitional | Eventually remove |
|---------|-------|--------------|-------------------|
| Emergency SOS | **Firestore callables** (cutover in progress) | Re-evidence 20-point physical matrix | Express SOS + JSON store + `responder-app/` |
| Identity | Express JWT + optional Firebase bridge | Clerk prep + `issueFirebaseBridgeTokenCallable` | Express citizen auth |
| Push devices | `orgDevices/{org}/tokens` | Mobile registers after bridge | Unscoped `fcmTokens` without org |
| Maintenance | Firestore requests/WOs | Responder mobile queue live | — |

**Express is legacy, not the destination architecture.** Do not port Person / memberships / grants / capabilities / work orders into Express.

---

## Device + push (`orgDevices`)

- Collection: `orgDevices/{organizationId}/tokens/{uid}_{deviceId}`
- Mirror: `fcmTokens/{uid}/devices/{deviceId}`
- Register: `registerPushToken` (server stamps org/person from membership)
- Revoke on logout: `revokePushTokenCallable` → `status: revoked`, token cleared
- Fan-out skips `status === 'revoked'`
- EAS project ID: `f9205a74-28bb-4abb-b289-13699fe0b32d` (from `app.json` / `Constants`)

### Delivery routing (`sendOrgPush`)

- `notifyOrgEvent` and `onIncidentCreatedNotify` call `sendOrgPushTokens`.
- Tokens starting with `ExponentPushToken[` / `ExpoPushToken[` → **Expo Push API**.
- All other tokens → **Admin FCM** multicast.
- Expo `DeviceNotRegistered` → revoke matching `orgDevices` docs.
- Emulator (`FIRESTORE_EMULATOR_HOST` / `FUNCTIONS_EMULATOR`) skips live network; reports attempted counts only.

### Expo / native strategy

- **CNG / prebuild:** Android tree is not checked in; EAS/prebuild generates native projects.
- **Dev client:** `eas.json` profile `development` (`developmentClient: true`, internal distribution). App scheme `safealert`. Plugin `expo-dev-client` + `expo-notifications` (`mode: production`).
- Expo project ID: `f9205a74-28bb-4abb-b289-13699fe0b32d` (`@lwandonova/safety-alert-app`).
- iOS `SafeAlert.entitlements` may be empty in repo until push capability is injected by EAS/`expo prebuild` with `expo-notifications` plugin.
- **Expo Go push = PARTIAL by design** — remote APNs/FCM + cold-start deep link require the development client.
- Do not invent a checked-in `android/` solely for audit completeness.

---

## Firebase environments

| Context | Project |
|---------|---------|
| Deploy (`.firebaserc`) | `seren-sos` |
| Emulator probes | `demo-seren` |
| Mobile client | `EXPO_PUBLIC_FIREBASE_*` (must not silently ship `demo-seren` in production builds) |

---

## SOS cutover gate

**Code path:** root Expo SOS + in-app responder emergency use Firestore callables (no Express dual-write).  
**Physical matrix:** mark **CUTOVER APPROVED: YES** only after ALL criteria PASS on physical devices.

1. User creates emergency incident from iOS  
2. User creates emergency incident from Android  
3. Incident reaches correct Firestore organisation  
4. Person/org/membership context correct  
5. Grants/capabilities evaluate correctly  
6. Only eligible responder receives it  
7. Responder receives push  
8. Responder can open incident  
9. Responder can acknowledge/accept  
10. Ops web sees same incident ID  
11. State changes propagate across all clients  
12. User sees relevant responder/state updates  
13. Tenant isolation passes  
14. Duplicate submissions controlled  
15. Offline/network failure behaviour acceptable  
16. Retry/idempotency acceptable  
17. Audit trail present  
18. Cold-start push navigation works  
19. Incident recoverable after app restart  
20. Physical-device tests pass on both platforms  

**CUTOVER APPROVED: IN PROGRESS** — mobile wired to Firestore; re-run physical matrix before YES.

### Shadowing

Do **not** dual-dispatch Express + Firestore. Express `/alerts` remains for legacy regression / `responder-app/` only.

---

## Platform session (mobile)

Central modules:

- `src/services/PlatformClient.ts` — bridge establish, org device register/revoke, org switch
- `src/context/PlatformSessionContext.tsx` — post-login session for person/org/membership
- `src/services/FirebaseCallables.ts` — callable transport (including SOS incident callables)
- Emergency SOS: `EmergencyDispatchService` → `createIncident` / `appendIncidentLocation`
- Responder emergency: `ResponderService` → `getNearbyIncidents` / `acceptIncident` / `updateIncidentStatus`

Bridge paths (unchanged contract): existing Firebase auth → Clerk session token → operator mint secret (emulator only).

---

## Org context policy

- Web: multi-org via Clerk OrganizationSwitcher.
- Mobile: one **persisted** active org (`platformActiveOrgId`); `organizationIdHint` only selects among the caller’s **active** memberships (fail-closed). Full switcher UI is prepared via `switchActiveOrganization` — product can expose it when multi-membership is common.

---

## Physical device verification matrix

Document results separately; do not claim completion from simulators alone.

| Client | iOS | Android |
|--------|-----|---------|
| User mobile | login, bridge, orgDevices, push F/B/cold, Report Issue, Express SOS regression | same |
| Responder mobile | login, bridge, WO queue/detail/complete, Express SOS queue regression, push | same |
| Ops web | assign WO → responder push → completion visible | — |

See also: [`GOLDEN_PATH_VERIFICATION.md`](./GOLDEN_PATH_VERIFICATION.md) for automated probe evidence and device-lab checklist.
