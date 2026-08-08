# Golden-path verification evidence

**Date:** 2026-08-08 (Android physical device pass); prior automation 2026-08-07  
**Branch:** `mobile/integration-repair` (from `cursor/phase-2b-tenant-backend-8d10`)  
**Rule:** Express SOS not cut over.

**Canonical Clerk application:** Seren SOS (`real-guppy-12`).  
Do **not** point mobile/web keys at Seren SOS Platform (`expert-drake-16`).

---

## Configuration applied (local / emulator)

| Surface | Setting |
|---------|---------|
| Mobile `.env` / `.env.local` | Clerk mobile **on** (Seren SOS); USB hosts `127.0.0.1` via `.env.local`; bridge mint kept for emulator fallback |
| Functions `.env` | Clerk keys for Seren SOS + matching mint / Express compat secrets |
| Emulator project | `demo-seren` |
| Deploy target (unchanged) | `seren-sos` |
| Lab start | `npm run lab:usb` → Express + emulators + Expo `--localhost` + `adb reverse` |

Secrets are gitignored. Templates updated in `.env.example` and `firebase/functions/.env.example`.

### Enable paths

**A — Bridge mint (emulator / device lab)**

```bash
# functions
MOBILE_BRIDGE_MINT_SECRET=...   # long random

# mobile
EXPO_PUBLIC_MOBILE_BRIDGE_MINT_SECRET=...  # same
EXPO_PUBLIC_MOBILE_BRIDGE_FIREBASE_UID=firebase_uid_a   # must have identityLinks + membership
EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001     # when using Functions emulator
EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-seren
```

**B — Clerk mobile (preferred for real devices — used for Android PASS)**

```bash
EXPO_PUBLIC_ENABLE_CLERK_MOBILE=true
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...   # Seren SOS / real-guppy-12
# .env.local (USB adb reverse):
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:4000
EXPO_PUBLIC_FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001
EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

Do **not** set `ALLOW_FIREBASE_AUTH_FALLBACK=false` until physical Clerk + push gate passes.

---

## Automated results (prior session)

### Maintenance golden path — `npm run probe:golden-path`

**10/10 PASS**

| Step | Result |
|------|--------|
| bridge-identity | PASS — student person + university-a |
| orgDevices-register | PASS |
| report-issue | PASS — requestId preserved |
| ops-assign-wo | PASS — workOrderId + requestId linked |
| responder-wo-queue | PASS — assignee sees WO |
| responder-wo-detail | PASS — same IDs |
| responder-wo-complete | PASS — WO + request → resolved |
| cross-tenant-wo-deny | PASS |
| orgDevices-revoke | PASS |
| express-sos-untouched | PASS (explicit non-cutover) |

Commands:

```bash
firebase emulators:start --only firestore,auth --config firebase/firebase.json --project demo-seren
cd firebase/functions && npm run seed:phase2b && npm run probe:golden-path
```

### Express SOS regression — `node scripts/express-sos-regression.js`

**11/11 PASS** (server on `:4000`)

| Step | Result |
|------|--------|
| health | PASS |
| citizen register/login | PASS |
| create SOS (auth) | PASS |
| create SOS (public) | PASS |
| responder login + shift | PASS |
| accept + status en_route | PASS |
| nearby map | PASS |
| firestore-untouched | PASS |

### Supporting suite

| Check | Result |
|-------|--------|
| Functions vitest | 103/103 |
| `probe:phase2b` | 8/8 |
| Web lint / build | PASS (prior turn) |

---

## Physical-device matrix

**Android device:** Xiaomi `2406APNFAG` (`degas`) via USB `adb` + `adb reverse` (ports 4000/5001/8080/8081/9099).  
**iOS (this pass):** iPhone 16 Simulator (iOS 18.5, UDID `064004AC-2CF8-4E84-BCC9-FDD193839459`) via Expo Go → `exp://127.0.0.1:8081`.  
**Physical iPhone:** NOT TESTED (none connected).  
**Clerk users:** student `user_3HbVtKcH57Flyw0ObCsbyhKqWkW`; responder `user_3HdOoempZCvqyQuYIksn2PKkbia` (`lwando@urbanlife.org.za`, seed track `hybrid` / `ALPHA-12`).  
**Date:** 2026-08-08.

| Client | Auth+bridge | orgDevices | Push F/B/cold | Report→WO | Express SOS |
|--------|-------------|------------|---------------|-----------|-------------|
| iOS user (Simulator) | **PASS** | **PASS** (register + revoke + re-register) | PARTIAL (Expo Go; no APNs) | **PASS** report create (WO assign not re-run) | **PASS** |
| iOS user (physical) | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN |
| Android user | **PASS** | **PASS** (register + revoke on logout) | PARTIAL (Expo Go; no native push) | **PASS** report create (WO assign not re-run on device) | **PASS** |
| iOS responder (Simulator) | **PASS** | PARTIAL (Expo Go) | PARTIAL | **PASS** Accept→Start→Resolve→Close (lab WO; transitions aligned) | **PASS** (clerk-compat + unit `ALPHA-12`) |
| Android responder | **PASS** | PARTIAL (Expo Go) | PARTIAL | **PASS** full WO lifecycle same `workOrderId` | **PASS** (clerk-compat + unit `ALPHA-12`) |

### Responder WO / capability evidence (2026-08-08)

| Check | Result |
|-------|--------|
| Transitions | `assigned → acknowledged → in_progress → resolved → closed` shared table; Ops mirrors |
| Android physical WO | PASS — lab WO closed with linked request; 5× `updateWorkOrderStatusCallable` |
| iOS Simulator responder shell | PASS — `unitId: ALPHA-12`, profile bridge; race fix for “session could not be loaded” |
| Capability separation probe | PASS — security denied plumbing assign; facilities assigned same request → WO |
| Seed tracks | `SEED_RESPONDER_TRACK=security\|facilities\|hybrid` (hybrid = lab dual-cap only) |
| UI branch gates | Map/Jobs show WOs only when facilities caps present; Jobs when incident caps |
| Express SOS cutover | **NO** |

### iOS Simulator user evidence (2026-08-08)

Lab: Metro `npx expo start --go --localhost` (or `npm run lab:usb` topology without `adb` when only Simulator).  
Expo Go 54.x / Expo SDK 54 / RN 0.81.5 / `@clerk/expo` ^4.2.1 / Firebase JS ^11.10.0.

| Step | Result |
|------|--------|
| Cold launch | PASS — JS bundle loads; Clerk plugins; Auth emulator `http://127.0.0.1:9099` |
| Clerk sign-in + device trust | PASS — `needs_client_trust` → email code (one incorrect OTP then success) |
| PlatformSession | PASS — `ready`, role `student`, `canUser: true`, org `university-a` |
| Firebase bridge | PASS — `issueFirebaseBridgeTokenCallable` + Auth emulator session |
| Express clerk-compat | PASS — `[ExpressClerkCompat] ready http://127.0.0.1:4000/auth/clerk-compat` |
| Kill/reopen | PASS — returns `ready` + Express compat |
| Report Issue | PASS — `operationalRequests/kGipgJjGC3GDz8gfmq7a` (“Power out”, SF simulator coords, `university-a`) |
| Community | PASS — `listCommunityGroups/Events/Alerts` + `listBroadcasts`; UI loads org-scoped shell |
| My Services | PASS — `getMyServicesCallable`; UI “University · university-a” |
| Express SOS | PASS — incident `4cd36ac6-…` for Clerk user, SF coords; **not** mirrored to Firestore ops incidents |
| Sign out | PASS — Clerk sign-in screen; `revokePushTokenCallable`; token `…_25F84` → `status: revoked` (Android `…_BP2A…` remains `active`) |
| Sign back in | PASS — `unauthenticated` → `ready` + Express compat; same deviceId `25F84` → `active` again (no duplicate doc) |
| Note | Post-logout toast `Location stream error Unauthorized` observed (SSE after session clear); does not block golden path |

### Android user evidence (2026-08-08)

| Step | Result |
|------|--------|
| USB reverse + Auth emulator | PASS — `[FirebaseAuth] connected to Auth emulator http://127.0.0.1:9099` |
| PlatformSession | PASS — `status: ready`, role `student`, `canUser: true` |
| Express clerk-compat | PASS — `[ExpressClerkCompat] ready http://127.0.0.1:4000/auth/clerk-compat` |
| Kill/reopen app | PASS — session returns `ready` + Express compat |
| Report Issue | PASS — Firestore `operationalRequests/WfATUzai4qTpELWjIXeN` (“Leaky pipes”, `university-a`) |
| Express SOS | PASS — Express incident `303d27d5-…` for Clerk user; **not** mirrored to Firestore |
| Community tab | PASS — `listCommunityGroups/Events/Alerts` + `listBroadcasts` callables |
| My Services | PASS — `getMyServicesCallable` returns University services shell |
| Sign out | PASS — auth screen; `revokePushTokenCallable`; orgDevices token `status: revoked` |
| Sign in | PASS — `unauthenticated` → `ready` + Express compat; orgDevices token `active` again; Home SOS shell visible |

### Device lab checklist (manual)

1. Copy `.env.example` → `.env`; set Clerk (Seren SOS) **or** bridge mint against `demo-seren`. USB: also `.env.local` with `127.0.0.1` hosts.  
2. `npm run lab:usb` (or `./scripts/lab-usb-start.sh --seed-clerk-user user_…`). Prefer USB; avoid Expo tunnel for bridge.  
3. Open `exp://127.0.0.1:8081` → login → PlatformSession `ready` (orgDevices row under `orgDevices/{org}/tokens`).  
4. Report Issue → note `requestId`.  
5. Ops web (Clerk org) assign → confirm push + WO id (dev client preferred for push).  
6. Responder app → Work orders → complete → confirm same `workOrderId` / request resolved.  
7. Logout → token `status=revoked`.  
8. Express SOS on device: Home SOS (legacy path).  
9. Confirm ops Firestore incidents **do not** receive Express SOS ids (split-brain still expected).  
10. After every emulator restart: `seed:phase2b` (+ device Clerk membership seed).

### Native blockers

- No checked-in `android/` (Expo CNG / EAS prebuild).  
- iOS push entitlements may be empty until EAS/`expo prebuild` injects APNs.  
- Live notify routes Expo tokens via Expo Push API and native tokens via FCM (`sendOrgPush`); emulator still skips live delivery.  
- Expo Go cannot fully exercise remote push (SDK 53+).

---

## Cutover

**CUTOVER APPROVED: NO**

Express SOS remains the accepted legacy emergency path. Golden-path automation covers Firestore maintenance only.

---

## How to re-run

```bash
# Preferred USB lab (one script)
npm run lab:usb
# After Clerk sign-in, if membership missing:
./scripts/lab-usb-start.sh --seed-clerk-user user_xxx
# Or separately:
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren \
  CLERK_USER_ID=user_xxx node scripts/seed-device-clerk-membership.js

# Automation only
npx firebase emulators:start --only firestore,auth,functions --config firebase/firebase.json --project demo-seren
cd firebase/functions && npm run seed:phase2b && npm run probe:golden-path && npm run probe:phase2b
cd server && node index.js
node scripts/express-sos-regression.js
```
