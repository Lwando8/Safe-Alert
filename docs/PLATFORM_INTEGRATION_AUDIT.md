# Seren — Platform Integration Audit

**Date:** 2026-08-07  
**Branch:** `cursor/phase-2b-tenant-backend-8d10`  
**Scope:** Post–hybrid Phases A–G verification across backend, Firebase, web, user mobile, responder mobile  
**Rule:** Audit and verify. Small safe fixes only. No architectural rewrite.

Classifications: **COMPLETE** | **PARTIAL** | **NOT IMPLEMENTED** | **LEGACY PATH REMAINS**

---

## 1. Executive conclusion

**Architecture side: MOSTLY**

Hybrid Phases A–G landed additive Person / Entitlement / grant / capability / My Services / vertical-pack seams on the **Firestore + Clerk web** path. Tenant isolation on migrated surfaces is strong and tested.

The platform does **not** yet behave as one coherent Person → Membership → Entitlement → Module → workflow loop across **all clients**, because:

1. **User SOS and in-app responder emergency flows still use Express + JSON store**, not Firestore callables / IncidentAccessGrant / Phase D capabilities.
2. **User mobile Clerk runtime is prep-only**; citizen login remains Express JWT. Firebase callable features soft-fail without a working bridge.
3. **Maintenance responder workflow is not on mobile**; ops assign is web/Firestore only.
4. **Push → `orgDevices` / FCM callable registration is not wired from mobile.**
5. **Separate `responder-app/` remains Express-only legacy.**

**Decision gate:** Core hybrid foundation on the **web ops + Firebase functions** track is sufficiently complete to **stop broad architecture rewrite**. Next primary phase should be **mobile integration repair** (bridge auth → callables, push registration, then responder maintenance queue) — **not** more domain redesign, and **not** marketplace (Phase H).

---

## 2. Repository inventory (runtime)

| Path | Role | Workspace? |
|------|------|------------|
| `/` (Expo root) | Primary user + in-app responder/admin mobile | Root package |
| `apps/web` (`@seren/web`) | Org ops + platform admin (Next.js + Clerk) | Yes |
| `packages/domain` (`@seren/domain`) | Shared domain types | Yes |
| `firebase/` + `firebase/functions` | Firebase config + Cloud Functions | Functions has own package |
| `server/` | Legacy Express dispatch + `data/store.json` | No |
| `responder-app/` | Standalone Expo responder (Express-only) | No |

**Workspaces:** only `packages/*` and `apps/*`. Root mobile, `server`, `responder-app`, and `firebase/functions` are siblings.

**Tests concentrated in** `firebase/functions` (Vitest). Root mobile and `apps/web` have **no** unit test suite. Web has ESLint (currently failing on unrelated hooks lint).

---

## 3. Primary model check

Target:

```
Person → Membership / Org context → Entitlement → Module → Incident / Work / Service → User or Responder workflow
```

| Layer | Backend/Firestore | Web ops | User mobile | Responder mobile |
|-------|-----------------|---------|-------------|------------------|
| Person | **COMPLETE** (`persons/`, compat id = Clerk) | Indirect (Clerk user) | **PARTIAL** (My Services callable; login is Express user) | Express unit identity |
| IdentityAccount | **PARTIAL** (`identityLinks` adapter) | Clerk session | **PARTIAL** bridge prep | N/A (Express) |
| Membership | **PARTIAL** (one active org per request) | **COMPLETE** Clerk org switch | **NOT IMPLEMENTED** switcher | Unit-bound org |
| Entitlements/Modules | **PARTIAL** (computed; modules primary) | **COMPLETE** profile-aware nav | **PARTIAL** My Services | Role only |
| Incident (emergency) | Firestore callables **COMPLETE** | Reads Firestore | **LEGACY** Express SOS | **LEGACY** Express |
| Work orders | Firestore **COMPLETE** | **COMPLETE** `/ops/requests` | Report Issue callable **PARTIAL** (bridge) | **NOT IMPLEMENTED** |
| Grants / capabilities | Firestore **COMPLETE** | N/A assign UI | N/A | Not on Express path |
| Notifications | Functions FCM + outbox **PARTIAL** | — | Local Expo token only | — |

---

## 4. Hybrid architecture implementation status

### Person — COMPLETE (compat model)

- Durable `persons/{personId}` with lazy ensure (`personService.ts`).
- Explicit compat rule: **`personId === Clerk userId`** (no re-key). Documented and tested.
- Stamped on membership sync, bridge, incident/request create, My Services.
- **Caveat:** Person is *synonymous* with Clerk id by design for this phase — not a separate opaque Seren UUID. Mobile Express users are **not** provisioned into `persons` on citizen login.

### IdentityAccount — PARTIAL + LEGACY PATH REMAINS

- Live store: `identityLinks` (Clerk ↔ Firebase uid). Domain `IdentityAccount` is an adapter view.
- Bridge: `issueFirebaseBridgeTokenCallable`.
- `ALLOW_FIREBASE_AUTH_FALLBACK` still true in functions env — intentional until mobile Clerk cutover.
- Mobile never writes `clerkSessionToken` today → Clerk-preferring bridge path incomplete.

### Organisation / Membership — PARTIAL

- One Person can have multiple Firestore memberships; Clerk web selects active org.
- `loadActiveMembershipForUser` requires an org hint when multiple active memberships exist (fail-closed).
- Membership revoke does not delete Person/identity.
- **User mobile has no org switcher** and Express citizen session is single-tenant-ish.

### Entitlements / Modules — PARTIAL

- `resolvePersonEntitlements` computes PLATFORM + ORGANISATION entitlements (marketplace stubs empty).
- Write gates: `assertModuleEnabled` (+ university composition on key callables).
- Ops nav uses effective modules/terminology (`ops-tenant-presentation.ts`); Phase G fixed hard-coded UNIVERSITY `RIDE_SAFETY: true`.
- Remaining: default profile fallback string `'UNIVERSITY'` when org doc incomplete; UI still uses route group name `(university)` (labeling, not access logic).

### IncidentAccessGrant — COMPLETE (Firestore) / LEGACY (Express)

- Written on Firestore `acceptIncident`; grant-aware update/location after revoke; resolve grace window.
- Express accept path has **no** grants.

### Responder capabilities — COMPLETE (Firestore) / LEGACY (Express)

- Phase D gates assign/accept/nearby `canAssign` and ops assignee/team category fit.
- Express `unitMatchesIncidentType` / role filters unchanged; mobile responder does not read `capabilities[]`.

### Audit — PARTIAL

- `auditEvents` on accept + ops request create/assign/status.
- Missing on incident create, community, broadcasts, ride safety.

### Dual SOS — LEGACY PATH REMAINS (explicit)

| Client action | Backend |
|---------------|---------|
| Mobile Home SOS | Express `POST /alerts` → `server/data/store.json` |
| Web `/ops/incidents` | Firestore Admin SDK (callable-created docs) |
| Firestore `createIncident` | Used by probes/web path — **not** wired from mobile Home |

---

## 5. Firebase / backend integration

### Projects and environments

| Surface | Project resolution | Notes |
|---------|-------------------|-------|
| Deploy / `.firebaserc` | **`seren-sos`** | Canonical live project |
| Functions emulator probes | **`demo-seren`** | Script default |
| Web Admin SDK | Env or fallback **`demo-seren`** | `apps/web/.env.local` has Clerk only (no Firebase project env in repo) |
| User mobile client SDK | `EXPO_PUBLIC_FIREBASE_*` or demo fallbacks | No committed live keys; no `google-services*` files |
| responder-app | **No Firebase** | Express `:4000` only |

**Answer:** Web ops and Firebase Functions are designed for the same platform (`seren-sos` when deployed). User mobile **can** talk to Functions via callables when env + bridge are configured, but **defaults and SOS still bind to Express**. Responder standalone app is **not** on Firebase. Clients are **not** uniformly pointing at one verified production config in-repo.

### Emulators (`firebase/firebase.json`)

- Auth `9099`, Functions `5001`, Firestore `8080`, RTDB `9000`, UI `4001`.

### Duplicate domain copies

- `@seren/domain` used by web.
- Functions maintains **local mirrors** (`collections.ts`, entitlements, capabilities, SLA, myServices, etc.) — drift risk.
- Mobile does **not** import `@seren/domain`.

### Dual data stores

- **Firestore:** platform multi-tenant collections.
- **Express JSON:** citizens, units, incidents, sessions for live mobile SOS/responder.

---

## 6. Firestore data model (canonical)

| Concept | Canonical collection | Tenant field | Used by |
|---------|---------------------|--------------|---------|
| Person | `persons` | n/a | Functions |
| Identity link | `identityLinks` | — | Functions bridge |
| Org / site / zone | `organizations`, `sites`, `zones` | id / orgId | Functions + web |
| Membership | `memberships` | `organizationId` | Functions + web |
| Incident | `incidents` | `organizationId` | Functions + web ops (**not** mobile SOS) |
| Access grant | `incidentAccessGrants` | via grant org | Functions |
| Ops request / WO | `operationalRequests`, `workOrders` | `organizationId` | Functions + web + mobile Report Issue |
| Teams | `teams` | `organizationId` | Functions + web assign |
| Community / broadcasts | `community*`, `broadcasts` | `organizationId` | Functions + web + mobile hub |
| Ride safety | `rideSafetyRequests` | `organizationId` | Functions (foundation) |
| Devices | `orgDevices`, `fcmTokens` | org-scoped | Functions (**mobile not registering**) |
| Audit / analytics | `auditEvents`, `analyticsEvents` | `organizationId` | Functions |
| Express incidents | `server/data/store.json` | provider/org fields | Mobile SOS + in-app responder |

No evidence of nested `organisations/{id}/incidents` vs flat `incidents` split on the Firestore path — flat + `organizationId` stamp is consistent. **Shadow model** is Express vs Firestore, not two Firestore layouts.

---

## 7. User mobile audit

### Launch path

```
App → initApiBaseUrl → ClerkMobilePrepBoundary → RootNavigator
  → Auth (Express JWT) → CitizenNavigator → Main tabs (Home…)
```

### Screens (mounted)

- Tabs: Home, Community, Alert (monitoring), Contacts, Profile  
- Stack: ReportIssue; Profile → MyServices, EditProfile, Medical, Settings, …  
- Orphaned: `AlertScreen`, `MyCommunityScreen`, `SafeZonesScreen`

### Authentication — PARTIAL

| Flow | Status |
|------|--------|
| Citizen Express login/logout/session restore | COMPLETE |
| Clerk mobile provider | PARTIAL (flag + `pk_` key; default `legacy_api`) |
| Writing Clerk session for bridge | NOT IMPLEMENTED |
| Firebase custom token bridge | PARTIAL (code exists; not on login path) |
| Multi-org selection | NOT IMPLEMENTED |

Known risk classes (contradictory auth UI, org loops): **not fully eliminated** — Express path is stable for SOS; callable features fail soft when bridge/membership missing. Not verified as resolved “globally.”

### Person-first vs tenant-first — PARTIAL

- My Services exists (Profile → catalog → routes) — **person-first presentation**.
- Primary entry remains **Home SOS** (legacy product UX) and Express auth (tenant-agnostic citizen).
- Smallest migration: keep Home SOS; require bridge on login so My Services/Report/Community work without soft-empty; add org switch only when multi-membership is common.

### Module visibility

| Module | Entitlement source | Backend | Screen | Completeness |
|--------|-------------------|---------|--------|--------------|
| SAFETY / SOS | Platform + catalog | **Express** | Home | COMPLETE (legacy store) |
| OPERATIONS | Org modules | Callable | ReportIssue + My requests | PARTIAL (bridge) |
| COMMUNITY* / BROADCASTS | Org modules | Callables | CommunityHub | PARTIAL (bridge) |
| RIDE_SAFETY | Org modules | Callables | Alert stub | PARTIAL foundation |
| ANALYTICS | — | — | — | NOT on user mobile |

Server is authoritative for callables; SOS bypasses that model.

### SOS end-to-end (code trace) — PARTIAL / split brain

```
Tap SOS → permissions/location → Express POST /alerts → JSON store
  → WS/location updates → Express responder accept/status
```

- Duplicate create guards: Express-side (not re-audited here as Firestore).
- **IncidentAccessGrant / membership-revoke survival: NOT on this path.**
- Web ops **cannot** see Express incidents in Firestore list (and vice versa) — **P0 product inconsistency**.
- Physical dispatch: **NOT VERIFIED**.

### Maintenance reporting — PARTIAL

```
ReportIssue → createOperationalRequestCallable → Firestore
  → /ops/requests (web) → assign + SLA + team → workOrders
```

- User status updates back to mobile: list-own only; **no push**.
- Responder mobile maintenance: **NOT IMPLEMENTED**.
- Attachments: limited / not fully verified.

### Notifications — NOT IMPLEMENTED (platform path)

- Local Expo token helper exists; placeholder project id **fixed in this audit** to EAS id from `app.json`.
- **No** call to `registerPushToken` / `orgDevices`.
- Probe `push-isolation` fails with 0 tokens (seed/env), confirming empty device registry in emulator runs.

---

## 8. Responder mobile audit

### What exists

1. **In-app ResponderNavigator** (same Expo app) — **primary** Express field ops.  
2. **`responder-app/`** — separate Expo client, Express `/alerts` — **LEGACY**; docs discourage building on it.

### Provisioning — PARTIAL

```
ResponderLogin → Express unit login → unit session → shift → map/assignments
```

- Not Seren Person + Membership + ResponderProfile from Firestore.
- Ordinary citizens cannot use responder routes without role in AsyncStorage (client gate) + Express auth (server gate).
- Capabilities[] **not** enforced on Express path.

### Emergency workflow — COMPLETE (Express only)

Nearby → accept → assignments → status → WS updates.  
Firestore grant/capability path **unused**.

### Maintenance workflow — NOT IMPLEMENTED

No work-order queue, accept, progress, resolve on responder mobile.

### Queue model — PARTIAL

Emergency queue only. No Emergency | Operational split UI.

---

## 9. Organisation admin ↔ clients

| Flow | Status |
|------|--------|
| Firestore incident → web ops list → assign unit → Firestore accept | COMPLETE on web/functions; **disconnected from mobile SOS** |
| Express alert → in-app responder | COMPLETE Express; **invisible to web Firestore ops** |
| User Report Issue → web triage/assign/SLA/team → WO | COMPLETE web; user list-own PARTIAL; responder WO **missing** |
| Broadcasts / community | COMPLETE callables + web + mobile hub (bridge-dependent) |
| Platform admin modules/profiles | COMPLETE Clerk platformAdmin |

**Canonical IDs:** Firestore uses document ids + `organizationId`. Express uses its own incident ids. **They do not share one ID space.**

### Real-time

| Workflow | Mechanism |
|----------|-----------|
| Express SOS / responder | WebSocket + REST poll patterns |
| Web ops | Server-rendered / fetch refresh (no Firestore listeners in ops clients reviewed) |
| Mobile community/My Services | Pull-to-refresh / mount fetch |
| Push | Incomplete registration |

---

## 10. API client consistency

| Client | Stack |
|--------|-------|
| User/responder (root) | `ApiClient` → Express; `FirebaseCallables` → Functions |
| responder-app | Own `dispatch.ts` → Express |
| Web | Next route handlers → Firebase Admin; Clerk session |

- No shared typed OpenAPI client across all three.
- Functions do not consume `@seren/domain` package (mirrors).
- Structured HttpsError codes on callables; Express uses its own error shapes.

---

## 11. Tenant isolation

| Surface | Status |
|---------|--------|
| Functions unit tests | COMPLETE (99 tests incl. isolation) |
| Emulator probes | MOSTLY (phase2b 7/8; push-isolation fails empty tokens) |
| Web loaders | COMPLETE (session org only) |
| Mobile Express | Provider/org checks on responder routes (legacy model) |
| Mobile callables | Server stamps org; client org ignored |
| Cross-store isolation | N/A — stores are separate worlds |

Client-supplied `organizationId` cannot override Firestore callable tenancy (verified by probes).

---

## 12. Caching / platform differences

- AsyncStorage: Express session, profile blobs, push token, API base override.
- Sign-out clears Express + Firebase auth + selected keys; org cache not a first-class concept.
- iOS project present; **android/** absent (prebuild).  
- Empty iOS entitlements / missing google-services → push/Firebase native **not device-ready**.  
- **No physical-device verification performed in this audit.**

### Location

- SOS location → Express alert stream.  
- Firestore incidents have location fields on callable create.  
- Grant-scoped location updates exist on Firestore path only.  
- Background tracking: not fully audited as enabled; permissions declared broadly in `app.json`.

---

## 13. Authorization pattern scan (sample)

| Pattern | Classification |
|---------|----------------|
| Server `authorize` / `authorizeAction` / `requireTenantMatch` | Valid domain |
| Web `resolveOpsSession` permission checks | Valid |
| Mobile `userRole === 'responder'` navigation | Valid UI + weak client gate (server must enforce) |
| `(university)` route group naming | Presentation leftover |
| Express role claims | LEGACY authorization (intentional until cutover) |
| Client-only module flags without server | Avoided on callables; SOS bypasses modules |

`authorizeAction` covers accept/assign incident and create/assign request; many paths still inline authorize (**PARTIAL** policy consolidation).

---

## 14. Tests run (this audit)

| Command | Result |
|---------|--------|
| `npm test --prefix firebase/functions` | **99/99 passed** |
| `npm run build --prefix firebase/functions` | Pass |
| `npm run build --prefix packages/domain` | Pass |
| `apps/web` `tsc --noEmit` | Pass (via prior/build path) |
| `apps/web` `npm run build` | Pass (Next routes incl. `/ops/ride-safety`) |
| `apps/web` `npm run lint` | **Fail** — 7 errors (hooks `setState` in effect in `use-mobile.ts` + other); 1 warning |
| `npm run probe:phase2b` | **7/8** — fail `push-isolation` (0 tokens) |
| Root mobile Jest/Detox | **None** |
| Physical device | **Not run** |

### Small fix applied during audit

- `src/services/NotificationService.ts`: replaced placeholder Expo `projectId` with EAS project id from `app.json`.  
  **Note:** Still does not register token with Firebase `orgDevices`.

---

## 15. Mobile build readiness

| Class | User mobile (root) | responder-app |
|-------|--------------------|---------------|
| Simulator-ready | PARTIAL (Expo; needs Express + optional emulators) | PARTIAL |
| Android device-ready | PARTIAL (no `android/` tree; no google-services) | PARTIAL |
| iOS device-ready | PARTIAL (ios/ present; empty push entitlements) | Unknown |
| Preview-build-ready (EAS) | PARTIAL (`eas.json` profiles exist) | Stub project id |
| Production-build-ready | **NO** (auth dual-stack, push, Firebase native config) | **NO** |

---

## 16. UI/UX observations (no redesign)

**User:** SOS-first Home is clear; My Services buried under Profile; callable empty states soft but can look “broken” without bridge; mixed Express vs tenant vocabulary.

**Responder:** Shift/map/assignments coherent for SOS; no operational queue; legacy `responder-app` duplicates concepts.

**Web ops:** Stronger module-gated shell, SLA/team on requests, ride-safety stub — ahead of mobile polish.

---

## 17. Remaining work categories

### A. Architecture blockers (stop calling “one platform” for SOS)

1. Dual SOS stores (Express vs Firestore) — mobile emergency ≠ web ops incidents.  
2. Express path lacks Person/grant/capability model.

### B. Integration blockers

1. Mobile Clerk session + Firebase bridge not on login.  
2. Push tokens never written to `orgDevices`.  
3. `@seren/domain` not shared with functions/mobile (drift).  
4. Web/mobile Firebase project env not committed/verified for `seren-sos`.

### C. Mobile functional gaps

1. Responder maintenance / work-order queue.  
2. Org switcher for multi-membership users.  
3. Ride safety UX beyond stub.  
4. Notification deep links / cold start routing.

### D. Firebase/backend gaps

1. Empty device registry (probe).  
2. Audit coverage incomplete.  
3. Indexes/deploy discipline operational (documented elsewhere).

### E. UI/UX improvements

1. Elevate My Services; align terminology.  
2. Responder Emergency | Operational IA.  
3. Web lint hygiene.

### F. Real-device verification

1. iOS/Android push, location, Clerk, EAS builds — **not done**.

### G. Future product

1. Marketplace / billing (Phase H).  
2. Access control / visitors / gates.  
3. Full ride matching product.

---

## 18. Readiness scorecard (0–100)

| Area | Score | Brief |
|------|------:|-------|
| Core architecture | **75** | Phases A–G on Firestore/web; dual SOS remains |
| Identity | **70** | Person+links complete on Clerk path; mobile Express parallel |
| Tenant isolation | **85** | Strong on migrated surfaces + tests |
| Entitlements/modules | **72** | Gates real; computed entitlements; not persisted |
| Firebase/backend integration | **55** | Functions solid; client env/bridge/push weak |
| User mobile | **50** | SOS Express works; tenant features bridge-fragile |
| Responder mobile | **45** | Express SOS OK; no WO; legacy second app |
| Emergency SOS | **40** | Works in Express silo; not cross-client Firestore |
| Maintenance workflow | **60** | User→web→assign solid; no responder mobile; weak notify |
| Notifications | **25** | Outbox/FCM server-side; mobile registration missing |
| Admin web | **80** | Clerk ops + modules + requests SLA/teams |
| Platform admin | **75** | Org profile/modules; pack restamp (Phase G) |
| iOS readiness | **35** | Project exists; entitlements/push incomplete |
| Android readiness | **30** | No checked-in native project / google-services |
| Automated testing | **70** | Excellent functions suite; no mobile/web E2E |
| Security | **70** | Server tenancy strong; client role gates weak; dual store risk |
| Production readiness | **35** | Not one verified prod client matrix |

Scores intentionally **not** inflated for “code exists but unwired.”

---

## 19. Highest-priority defects

### P0

1. **Split-brain SOS:** mobile Express incidents invisible to Firestore `/ops/incidents` (and grants/capabilities unused on live SOS).  
2. **Mobile callable auth gap:** Clerk token never stored; bridge not part of citizen login → Report Issue / Community / My Services unreliable in default config.

### P1

3. Mobile does not register push tokens with `orgDevices` / `registerPushToken`.  
4. Responder has no maintenance/work-order workflow while web assigns WOs.  
5. `responder-app/` and root responder duplicate legacy Express surfaces.  
6. Emulator push-isolation probe failing (0 tokens) — signals notification pipeline unverified.

### P2

7. Domain package not shared with functions (drift).  
8. Web ESLint failures.  
9. Audit events incomplete coverage.  
10. Placeholder/demo Firebase fallbacks if env unset.

---

## 20. Next recommended build phase (ONE)

### **Mobile integration repair**

Exact sequence:

1. **Wire post-login Firebase bridge** for citizen sessions (Clerk prep token **or** operator/custom-token path that works in current `legacy_api` mode) so callables succeed without manual steps.  
2. **Register Expo push tokens** via `registerPushToken` → `orgDevices` after auth; re-run push-isolation probe.  
3. **Document/decide SOS cutover gate** (do not cut over yet): tracking issue for Express→Firestore when bridge+push+ops parity exist.  
4. **Add responder “Operational” queue** reading assigned `workOrders` / requests for the unit’s org (Firestore callables + capability-aware), without merging into emergency status machine.  
5. Only then: physical-device notification + location verification (iOS/Android).

Do **not** start Phase H marketplace. Do **not** redesign all screens. Do **not** delete Express until cutover criteria are met.

---

## 21. Final decision gate

> Is Seren's hybrid person-first / tenant-first platform foundation now sufficiently complete that core architecture work can stop and development can shift primarily to user-mobile, responder-mobile, cross-client integration, and UX verification?

### **YES — with scope boundary**

**Stop** broad hybrid architecture expansion (A–G foundations are in place on the Firestore/Clerk track).

**Shift** to **mobile integration repair** and cross-client wiring as above.

**Continue treating Express SOS as an accepted LEGACY PATH** until an explicit cutover milestone — that milestone is **integration work**, not another domain model phase.

---

## Appendix A — Hybrid phase docs (implemented)

| Phase | Doc |
|-------|-----|
| A Audit | `HYBRID_ARCHITECTURE_AUDIT.md` |
| B Foundations | `HYBRID_PHASE_B.md` |
| C University mapping | `HYBRID_PHASE_C.md` |
| D Capabilities | `HYBRID_PHASE_D.md` |
| E SLA + team picker | `HYBRID_PHASE_E.md` |
| F My Services | `HYBRID_PHASE_F.md` |
| G Vertical packs + ride | `HYBRID_PHASE_G.md` |

## Appendix B — Key runtime entrypoints

| Concern | Path |
|---------|------|
| Mobile SOS | `src/services/EmergencyDispatchService.ts` → Express |
| Mobile callables | `src/services/FirebaseCallables.ts` |
| My Services | `src/screens/MyServicesScreen.tsx` |
| Functions incidents | `firebase/functions/src/index.ts`, `incidents/tenantIncidentService.ts` |
| Ops session | `apps/web/src/lib/ops-session.ts` |
| Express server | `server/index.js` |
| Responder in-app | `src/navigation/ResponderNavigator.tsx` |
| Legacy responder app | `responder-app/` |
