# HYBRID ARCHITECTURE AUDIT

**Date:** 2026-08-07  
**Branch:** `cursor/phase-2b-tenant-backend-8d10`  
**Scope:** Person-first identity + tenant-first authorization + modular entitlements + responder/work-management foundations  
**Rule:** Evolve, do not rewrite.

Classifications used: **KEEP** | **EXTEND** | **ADAPT** | **MIGRATE** | **DEPRECATE LATER** | **REPLACE ONLY IF NECESSARY**

---

## 1. Executive summary

Seren is already a **tenant-strong multi-tenant platform** with:

- Clerk org → Firestore membership sync
- Server-stamped `organizationId` on callables and web ops loaders
- Module flags (`settings.modules`) with fail-closed `assertModuleEnabled`
- Separate **emergency incidents** and **operational requests / work orders**
- Isolation tests and emulator probes

**Gaps vs the hybrid target:**

- No `Person` abstraction — Clerk `userId` is the de facto person id
- `identityLinks` bridge Clerk↔Firebase only (not a full IdentityAccount model)
- No first-class `Entitlement` — org module flags approximate organisation-sourced entitlements
- Authorization is largely RBAC permission strings + tenant match (not ReBAC/ABAC policy engine)
- No `IncidentAccessGrant` for emergency access after membership revocation
- No real `auditEvents` writer (analytics + timelines only)
- Dual SOS path: **mobile Express** (live) vs **Firestore callables** (web ops / migrated surface)

**Smallest safe evolution:** Keep tenant pipelines; add Person/Entitlement/policy seams additively; extend operational requests for maintenance; do **not** merge maintenance into Incident; do **not** cut over Express SOS in this cycle.

---

## 2. Current architecture

### Repository structure

| Path | Role |
|------|------|
| `apps/web` | Next.js University Ops + Platform Admin (Clerk-only) |
| `packages/domain` | Shared types, tenantConfig, COLLECTIONS |
| `firebase/functions` | Callables, webhook, dual-auth middleware, tenant services |
| `src/` (Expo root) | Citizen / Responder / Admin navigators |
| `server/` | Legacy Express SOS + auth (still used by mobile SOS) |
| `responder-app/` | Legacy separate RN client — do not build on |
| `docs/` | Phase 2 / expansion / operator docs |

### Identity (today)

| Stack | Canonical id | Notes |
|-------|--------------|-------|
| Clerk | `userId` | Phase 2 authority for web + migrated callables |
| Firebase | `uid` | Via `identityLinks`; claims fallback when `ALLOW_FIREBASE_AUTH_FALLBACK` |
| Express | opaque session user id | Parallel store; not linked to Person |

**No `Person` / `personId` collection.** Memberships, incidents, requests store `userId` (Clerk id on migrated path).

### Tenant model

Flat Firestore: `organizations`, `sites`, `zones`, `memberships` with `organizationId` fields.  
Org bootstrap stamps `tenantProfile` + `settings.modules|terminology|categories`.  
Web/API **ignore** client-supplied `organizationId`.

### Authorization

- Membership `permissions[]` from `derivePermissions(clerkRole)`
- `authorize` / `authorizeAnyPermission` / `requireTenantMatch` on `RequestContext`
- Module gate: `assertModuleEnabled`
- Platform: Clerk `publicMetadata.platformAdmin`
- Legacy: Firebase role claims + Express roles (parallel)

### Incident / SOS path

```
Mobile Home SOS → Express POST /alerts → JSON store + WebSocket
Web /ops/incidents → Firestore Admin SDK (callables-created incidents)
Firebase createIncident/acceptIncident/... → Firestore + timeline + FCM trigger
```

### Responder

- Domain `Responder` + `responderUnits` / `shifts`
- Membership embed `responderProfile`
- Mobile responder UI → Express
- No first-class `capabilities[]` yet

### Maintenance / work management

Already present as **separate** collections:

- `operationalRequests` + timeline
- `workOrders` (create-on-assign)
- Statuses: `submitted → acknowledged → assigned → in_progress → … → resolved → closed`
- Mobile Report Issue + `/ops/requests`

### Notifications

- `onIncidentCreatedNotify` — direct FCM to `orgDevices`
- `notifyOrgEvent` — outbox + FCM for ops/community/broadcasts

### Audit

- Domain `AuditEvent` type exists
- **No** `auditEvents` collection writer in production paths
- Closest: request/incident `timeline` subcollections + `analyticsEvents` (metrics)

---

## 3. What already matches the target

| Target concept | Current | Class |
|----------------|---------|-------|
| Organisation tenant boundary | Org + membership + stamp | **KEEP** |
| Site / Zone | Domain + Firestore | **KEEP** |
| Membership Person↔Org | `memberships.userId` + `organizationId` | **KEEP** (userId → personId compat) |
| Module capability catalogue | `PlatformModule` + profile defaults | **EXTEND** |
| Facilities reporting | OperationalRequest / WorkOrder | **KEEP / EXTEND** |
| Fail-closed isolation tests | Vitest + probes | **KEEP / EXTEND** |
| Web Clerk-only ops/platform | auth-guards | **KEEP** |

---

## 4. What partially matches

| Target | Current | Class |
|--------|---------|-------|
| Person | Clerk userId | **ADAPT** — additive Person, `personId === clerkUserId` |
| IdentityAccount | `identityLinks` | **ADAPT** — adapter, defer rename |
| Entitlement | org `settings.modules` | **EXTEND** — Entitlement beside modules |
| Contextual auth / policy | authorize + tenant match | **EXTEND** — named `authorizeAction` |
| Responder specialisation | responderType string | **EXTEND** — capabilities |
| Consent | TrustedContact stub | **EXTEND** — ConsentGrant types only |
| Audit | timelines / analytics | **EXTEND** — auditEvents helper |

---

## 5. What conflicts with the target

| Conflict | Why | Class |
|----------|-----|-------|
| Dual SOS stores | Mobile Express ≠ web Firestore | **KEEP** Express until cutover gate; **DEPRECATE LATER** |
| Claim-only responder paths | Bypass membership when fallback on | **ADAPT** later; do not flip flag now |
| Nested DOMAIN-MODEL.md vs flat COLLECTIONS | Doc drift | **ADAPT** docs |
| Marketplace / access control | Out of programme | **DEPRECATE LATER** (not built) |

---

## 6. High-risk coupling

1. Mobile SOS → Express; web incidents → Firestore  
2. `ALLOW_FIREBASE_AUTH_FALLBACK` vs membership authority  
3. Overloaded “alert” (SOS vs community alerts)  
4. `org:responder` permissions include facilities update/resolve  
5. Analytics mistaken for compliance audit  
6. Destructive personId re-key would break all foreign keys  

---

## 7. Reusable components

- `RequestContext` + membershipLoader + MembershipSyncService  
- `tenantConfig` / `moduleGate`  
- `tenantRequestService` + ops-requests UI  
- `tenantIncidentService` (Firestore path)  
- `notifyOrgEvent` / orgDevices  
- `IdentityLinkService` (bridge pattern)  
- Isolation test harness + MemoryDb patterns  

---

## 8. Required migrations (additive)

| Migration | Approach |
|-----------|----------|
| Person docs | Lazy `persons/{personId}` merge; personId = Clerk userId |
| IdentityAccount | Adapter over `identityLinks`; no collection rename yet |
| Entitlements | Resolve from modules + active membership; no marketplace |
| IncidentAccessGrant | Type + unit rules; wire on Firestore `acceptIncident` additively |
| auditEvents | Append-only helper on request assign/status |
| Enum renames for work statuses | **Do not rename stored enums** in Phase B — document vocabulary map only |

---

## 9. Things that must NOT be rewritten

- Incident assignment / map status machine semantics  
- Express mobile SOS Home path  
- Flat Firestore collection layout  
- Web Clerk-only ops/platform boundary  
- OperationalRequest status enum values in existing documents  
- `server/` and `responder-app/` deletion  
- Full marketplace / access-control verticals  

---

## 10. Recommended incremental path

| Phase | Focus | This cycle |
|-------|-------|------------|
| **A** | Audit (this doc) | **Yes** |
| **B** | Person / Entitlement / policy / grant types / audit helper | **Yes** |
| **C** | Map university flows onto hybrid seams without rebuild | **Done** — see [`HYBRID_PHASE_C.md`](./HYBRID_PHASE_C.md) |
| **D** | Responder capabilities enforcement | Later |
| **E** | Maintenance UX deepen (SLA, team picker) | Later |
| **F** | My Services person-first nav | Later |
| **G** | Additional verticals | Later |
| **H** | Marketplace / billing | Later |

---

## 11. Data migration risk

**Low** if personId = existing Clerk userId and all writes are merge-only.  
**High** if any script rewrites `userId` fields across collections.

---

## 12. Authentication migration risk

**High** if Clerk mobile cutover or fallback disable happens prematurely.  
**Keep** dual-auth bridge and Express citizen login unchanged in Phase B.

---

## 13. Tenant isolation risk

Current posture is strong on migrated surfaces. Risk rises if new Person helpers ever trust client org/person ids. All new APIs must continue stamping from `RequestContext` / session membership.

---

## 14. Responder architecture findings

- Shared platform for security + facilities is already intended via Teams + WorkOrders  
- Emergency marketplace (Express) and facilities assign (Firestore) must stay separate workflows  
- Add `capabilities[]` optionally; do not force maintenance onto `responderUnits` SOS units  

---

## 15. Maintenance / work-management findings

**Decision (locked):** Maintenance = `operationalRequests` + `workOrders`.  
Do **not** model maintenance as emergency `Incident`.

Vocabulary map (docs only — stored enums unchanged):

| Stored status | Conceptual |
|---------------|------------|
| submitted | NEW |
| acknowledged | TRIAGED |
| assigned | ASSIGNED |
| in_progress | IN_PROGRESS |
| awaiting_information / on_hold | BLOCKED-ish |
| resolved | RESOLVED |
| closed | CLOSED |

---

## Stop conditions observed

None that block Phase B/C additive foundations. Dual SOS remains an accepted deferred risk (**DEPRECATE LATER**), not a rewrite trigger. Phase C keeps Express SOS and does not disable Firebase auth fallback.
