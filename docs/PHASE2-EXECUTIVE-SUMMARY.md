# PHASE 2 — EXECUTIVE SUMMARY

**Date**: 2026-08-05  
**Classification**: CRITICAL — SYSTEM NOT TENANT-SAFE

---

## SAFETY VERDICT

🔴 **The system is NOT safe for multi-university deployment**

Multiple universities CANNOT be onboarded until Phase 2 tenant isolation is fully implemented and verified.

---

## ARCHITECTURAL STATUS AT A GLANCE

| Layer | Status | Risk |
|-------|--------|------|
| **Domain Types** | ✅ Ready | Low — Already tenant-scoped |
| **Authentication** | ⚠️ Partial | Medium — No membership model |
| **Authorization** | ❌ Missing | **CRITICAL** — No org boundaries |
| **Data Storage** | ❌ Unsafe | **CRITICAL** — No org filtering |
| **API Functions** | ❌ Unsafe | **CRITICAL** — Global queries |
| **Mobile State** | ❌ Unsafe | **CRITICAL** — Client-authoritative |
| **Push Notifications** | ❌ Unsafe | **CRITICAL** — Broadcasts globally |
| **Web Routes** | ⚠️ Partial | High — No authentication |

---

## TOP 5 CRITICAL VULNERABILITIES

### 1. Cross-Tenant Incident Access
**Severity**: 🔴 CRITICAL

Any authenticated responder can view ALL incidents from ALL universities.

```typescript
// Current (UNSAFE)
const list = await db
  .collection('incidents')
  .where('status', '==', 'open')
  .get();
// Returns incidents from ALL organizations
```

**Impact**: Privacy violation, POPIA/GDPR non-compliance, contract breach

---

### 2. Unauthorized Incident Assignment
**Severity**: 🔴 CRITICAL

Responder from University A can accept incidents from University B.

```typescript
// Current (UNSAFE) - no ownership check
export const acceptIncident = onCall(async req => {
  requireAuth(req);
  const { incidentId } = req.data;
  // ❌ No check if incident belongs to responder's organization
  await db.doc(`incidents/${incidentId}`).update({ /* ... */ });
});
```

**Impact**: Response coordination failure, safety risk, operational chaos

---

### 3. Global Push Notification Broadcast
**Severity**: 🔴 CRITICAL

New incident at University A notifies ALL devices across ALL universities.

```typescript
// Current (UNSAFE)
export const onIncidentCreatedNotify = onDocumentCreated(
  'incidents/{incidentId}',
  async event => {
    // ❌ Queries ALL tokens across ALL organizations
    const tokenSnap = await db.collectionGroup('devices').get();
    // ❌ Sends to EVERYONE
    await admin.messaging().sendEachForMulticast({ tokens, /* ... */ });
  }
);
```

**Impact**: Alert fatigue, false alarms, privacy violation

---

### 4. Client-Authoritative Tenant Identity
**Severity**: 🔴 CRITICAL

Mobile client provides `organizationId` without server validation.

```typescript
// Mobile (UNSAFE)
const providerId = userProfile.providerId;  // ⚠️ Client-controlled

// Server (UNSAFE)
const incident = {
  providerId: req.data.providerId || null,  // ❌ Trusted
  // No organizationId from membership
};
```

**Impact**: User can spoof membership, cross-tenant data pollution

---

### 5. No Membership System
**Severity**: 🔴 CRITICAL

Users are not explicitly linked to organizations via membership records.

**Current**: User has optional `providerId` string field  
**Required**: `memberships` collection with status enforcement

**Impact**: No way to revoke access, suspend users, or enforce boundaries

---

## KEY MISSING COMPONENTS

### 1. Membership System
- [ ] `memberships/{membershipId}` collection
- [ ] Link users to organizations on registration
- [ ] Active membership validation on sign-in
- [ ] Organization selection (if multiple)
- [ ] Status enforcement (suspended, revoked)

### 2. Request Context
- [ ] Server-authoritative `RequestContext` builder
- [ ] Extract `organizationId` from membership
- [ ] Inject context into all Cloud Functions
- [ ] Reject client-supplied organization ID

### 3. Permission System
- [ ] Centralized `authorize()` function
- [ ] Permission model (`incidents:create`, etc.)
- [ ] Map membership kinds to permissions
- [ ] Enforce in all protected operations

### 4. Tenant-Scoped Queries
- [ ] Repository pattern with required `organizationId`
- [ ] Migrate all Firestore queries
- [ ] Remove global query methods
- [ ] Add organization indexes

### 5. Organization-Scoped Notifications
- [ ] Add `organizationId` to FCM token storage
- [ ] Filter notification queries by organization
- [ ] Test isolation between universities

---

## PHASE 2 CRITICAL PATH

### Week 1-2: Membership Foundation
1. Create `memberships` Firestore collection
2. Link users to organizations on registration
3. Backfill memberships for existing users
4. Implement membership validation in auth flow

### Week 3-4: Request Context & Authorization
1. Build authoritative `RequestContext` from membership
2. Inject context into all Cloud Functions
3. Implement centralized `authorize()` function
4. Define and enforce permission model

### Week 5-6: Data Layer Migration
1. Add `organizationId`, `siteId`, `zoneId` to incidents
2. Backfill existing incidents
3. Create repository pattern with org filtering
4. Migrate all queries to repositories

### Week 7: Notification Isolation
1. Add `organizationId` to FCM token storage
2. Rewrite notification trigger with org filter
3. Test cross-tenant notification isolation

### Week 8: Testing & Verification
1. Implement 10+ cross-tenant isolation tests
2. Web route protection (auth + authorization)
3. Mobile bootstrap with org selection
4. Phase 2 verification report

---

## STOP-GATE CRITERIA

Phase 2 passes ONLY when:

✅ Two test universities provisioned  
✅ User from University A cannot see University B incidents  
✅ Responder from University A cannot accept University B incident  
✅ New incident at University A does NOT notify University B  
✅ Client-supplied `organizationId` is rejected  
✅ Suspended membership blocks API access  
✅ Cross-tenant test suite passes (10+ tests)  
✅ Phase 2 verification report complete

---

## ESTIMATED EFFORT

**Duration**: 6-8 weeks (single experienced developer)  
**Complexity**: High — pervasive architectural changes  
**Risk**: Medium-High — touches all layers

---

## ARCHITECTURAL STRENGTHS (Keep)

✅ Excellent domain model at type level (`@seren/domain`)  
✅ Clean monorepo structure with workspaces  
✅ Modern stack (Next.js 16, React Native, Firebase)  
✅ Responsive design system (shadcn/ui)  
✅ Clear separation of university vs platform routes  

---

## NEXT IMMEDIATE ACTIONS

1. **Review this summary with technical lead**
2. **Read full inspection**: `docs/PHASE2-TENANT-BOUNDARY-INVENTORY.md`
3. **Begin Priority 1**: Membership System implementation
4. **Set up automated test harness** for cross-tenant isolation
5. **Schedule Phase 2 stop-gate review** (target: 8 weeks)

---

## COMPLIANCE IMPLICATIONS

### POPIA/GDPR
- ❌ Data minimization violated (cross-org visibility)
- ❌ Purpose limitation violated (data accessible beyond need)
- ⚠️ Data subject rights at risk (complex deletion/export)

### University Contracts
- ❌ "Student data must not be shared with other institutions"
- ❌ "Only authorized campus security may access incidents"
- ❌ "Location tracking limited to authorized responders"

**None of these guarantees can currently be met.**

---

## CLASSIFICATION

**Document**: Phase 2 Architectural Inspection — Executive Summary  
**Status**: Complete  
**Full Report**: `docs/PHASE2-TENANT-BOUNDARY-INVENTORY.md` (18 sections, 2000+ lines)  
**Next Document**: Phase 2 Implementation Plan (to be created after review)
