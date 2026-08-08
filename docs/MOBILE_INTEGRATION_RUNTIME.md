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

---

## Current runtime

| Surface | Authoritative path today |
|---------|--------------------------|
| **Ops / platform web** | Clerk + Firestore/Functions (`seren-sos` when deployed; emulator `demo-seren`) |
| **User mobile SOS** | **Legacy Express** `POST /alerts` → `server/data/store.json` → in-app responder Express queue |
| **User mobile Report / Community / My Services** | Firebase callables after **platform bridge** |
| **Responder mobile emergency** | Same Expo binary (`src/screens/responder/*`) → Express queue |
| **Responder mobile work orders** | Firestore callables (`listMyWorkOrdersCallable` / `updateWorkOrderStatusCallable`) |
| **Standalone `responder-app/`** | **Legacy duplicate** — Express-only; do not extend |

### Canonical responder app

**Canonical:** root Expo app role `responder` (`src/screens/responder/`).  
**Legacy:** `responder-app/` — freeze; remove only after explicit verification that no store/build pipeline depends on it.

---

## Migration direction

| Concern | Today | Transitional | Eventually remove |
|---------|-------|--------------|-------------------|
| Emergency SOS | Express | Keep until cutover gate | Express SOS + JSON store |
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

**Do not remove Express SOS until ALL criteria PASS on physical devices.**

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

**CUTOVER APPROVED: NO** (until the matrix above is evidenced).

### Shadowing

Do **not** dual-dispatch Express + Firestore. Safer alternative: keep Express authoritative for emergency until cutover; use Firestore only for maintenance/ops; document seam observability via this note + probes.

---

## Platform session (mobile)

Central modules:

- `src/services/PlatformClient.ts` — bridge establish, org device register/revoke, org switch
- `src/context/PlatformSessionContext.tsx` — post-login session for person/org/membership
- `src/services/FirebaseCallables.ts` — callable transport
- Express SOS remains on `ApiClient` / `DispatchApi`

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
