# PHASE 2 — CURRENT VS TARGET ARCHITECTURE

## CURRENT ARCHITECTURE (Phase 1)

```
┌─────────────────────────────────────────────────────────────┐
│                    MOBILE APP (React Native)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  AsyncStorage                                         │   │
│  │  ┌──────────────────────────────────────────────┐   │   │
│  │  │ user: { providerId: "org-a" }  ⚠️ CLIENT     │   │   │
│  │  └──────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓ sends                            │
│              { providerId: "org-a", ... } ⚠️                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              FIREBASE CLOUD FUNCTIONS (Backend)              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ createIncident(req)                                   │   │
│  │   ❌ NO membership check                             │   │
│  │   ❌ NO organization validation                      │   │
│  │   incident.providerId = req.data.providerId ⚠️       │   │
│  │   await db.doc(`incidents/${id}`).set(incident)      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ getNearbyIncidents(req)                               │   │
│  │   ❌ NO organization filter                          │   │
│  │   return ALL open incidents (global)                  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ onIncidentCreated (Firestore Trigger)                 │   │
│  │   ❌ Queries ALL fcmTokens                           │   │
│  │   ❌ Sends notification to EVERYONE                  │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  FIRESTORE (Database)                        │
│                                                              │
│  incidents/{incidentId}                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ {                                                     │   │
│  │   id: "inc-001",                                      │   │
│  │   type: "sos",                                        │   │
│  │   userId: "user-123",                                 │   │
│  │   providerId: "org-a",  ⚠️ CLIENT-SUPPLIED          │   │
│  │   ❌ NO organizationId                               │   │
│  │   ❌ NO siteId                                       │   │
│  │   ❌ NO zoneId                                       │   │
│  │   location: { lat, lng },                             │   │
│  │   status: "open"                                      │   │
│  │ }                                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  users/{userId}                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ {                                                     │   │
│  │   id: "user-123",                                     │   │
│  │   email: "guard@uni-a.ac.za",                         │   │
│  │   providerId: "org-a",  ⚠️ NO VALIDATION            │   │
│  │   ❌ NO membership link                              │   │
│  │ }                                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ❌ NO memberships collection                                │
│  ❌ NO organization scoping on queries                       │
└─────────────────────────────────────────────────────────────┘

PROBLEMS:
❌ Responder from University A sees incidents from University B
❌ Client can spoof organizationId
❌ No membership validation
❌ Notifications broadcast globally
❌ No authorization boundary enforcement
```

---

## TARGET ARCHITECTURE (Phase 2)

```
┌─────────────────────────────────────────────────────────────┐
│                    MOBILE APP (React Native)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  1. Sign In                                           │   │
│  │  2. Load memberships for user                         │   │
│  │  3. Select organization (if multiple)                 │   │
│  │  4. Cache: activeMembershipId ✅                     │   │
│  │  5. ❌ NEVER send organizationId to server          │   │
│  └──────────────────────────────────────────────────────┘   │
│                           ↓                                  │
│              { incidentType, location, ... }                 │
│              ✅ NO organizationId sent                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              FIREBASE CLOUD FUNCTIONS (Backend)              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ createIncident(req)                                   │   │
│  │   1. requireAuth(req)                                 │   │
│  │   2. context = buildRequestContext(req.auth.uid) ✅  │   │
│  │      ├─ Load active membership                        │   │
│  │      ├─ Extract organizationId from membership        │   │
│  │      ├─ Extract siteId, permissions                   │   │
│  │      └─ Validate membership status = 'active'         │   │
│  │   3. authorize(context, 'incidents:create') ✅       │   │
│  │   4. incident.organizationId = context.organizationId│   │
│  │      incident.siteId = context.siteId                 │   │
│  │      incident.zoneId = input.zoneId                   │   │
│  │   5. await IncidentRepo.create(context, incident) ✅ │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ getNearbyIncidents(req)                               │   │
│  │   1. context = buildRequestContext(req.auth.uid)      │   │
│  │   2. authorize(context, 'incidents:read-all')         │   │
│  │   3. return IncidentRepo.getByOrganization(           │   │
│  │        context.organizationId,                        │   │
│  │        { status: 'open' }                             │   │
│  │      ) ✅                                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ onIncidentCreated (Firestore Trigger)                 │   │
│  │   1. Extract incident.organizationId ✅              │   │
│  │   2. Query fcmTokens WHERE organizationId = X ✅     │   │
│  │   3. Send notification ONLY to org members ✅        │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  FIRESTORE (Database)                        │
│                                                              │
│  memberships/{membershipId} ✅ NEW                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ {                                                     │   │
│  │   id: "mem-001",                                      │   │
│  │   organizationId: "org-university-a", ✅             │   │
│  │   siteId: "site-main-campus",                         │   │
│  │   userId: "user-123",                                 │   │
│  │   kind: "security_guard",                             │   │
│  │   status: "active", ✅                               │   │
│  │   permissions: ["incidents:read-all", ...]            │   │
│  │ }                                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  incidents/{incidentId}                                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ {                                                     │   │
│  │   id: "inc-001",                                      │   │
│  │   organizationId: "org-university-a", ✅ SERVER      │   │
│  │   siteId: "site-main-campus", ✅ NEW                │   │
│  │   zoneId: "zone-library", ✅ NEW                    │   │
│  │   userId: "user-456",                                 │   │
│  │   type: "sos",                                        │   │
│  │   location: { lat, lng },                             │   │
│  │   status: "open"                                      │   │
│  │ }                                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  users/{userId}                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ {                                                     │   │
│  │   id: "user-123",                                     │   │
│  │   email: "guard@uni-a.ac.za",                         │   │
│  │   fullName: "Security Guard",                         │   │
│  │   ❌ NO providerId (removed)                         │   │
│  │   ✅ Link via memberships collection                │   │
│  │ }                                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  fcmTokens/{userId}/devices/{deviceId}                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ {                                                     │   │
│  │   token: "ExponentPushToken[...]",                    │   │
│  │   organizationId: "org-university-a", ✅ NEW        │   │
│  │   environment: "production",                          │   │
│  │   updatedAt: 1234567890                               │   │
│  │ }                                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ✅ ALL queries filtered by organizationId                  │
│  ✅ Composite indexes: (organizationId, status, createdAt)  │
└─────────────────────────────────────────────────────────────┘

GUARANTEES:
✅ Responder from University A sees ONLY University A incidents
✅ Client CANNOT spoof organizationId (server derives it)
✅ Active membership required for all operations
✅ Notifications sent ONLY to organization members
✅ Authorization enforced at permission level
✅ Suspended membership blocks access
```

---

## REQUEST CONTEXT FLOW (Phase 2)

```
┌─────────────┐
│ Mobile App  │
│ (React      │
│  Native)    │
└──────┬──────┘
       │
       │ 1. User signs in
       │    Firebase Auth returns JWT with uid
       │
       ↓
┌──────────────────────────────────────────────────────────┐
│  Firebase Cloud Function                                  │
│                                                           │
│  function createIncident(request) {                       │
│    // 1. Authenticate                                     │
│    requireAuth(request);                                  │
│                                                           │
│    // 2. Build authoritative context ✅                  │
│    const context = await buildRequestContext(            │
│      request.auth.uid                                     │
│    );                                                     │
│                                                           │
│    /*                                                     │
│     * buildRequestContext(uid):                          │
│     *   - Query memberships WHERE userId = uid           │
│     *   - Filter memberships WHERE status = 'active'     │
│     *   - Get activeMembershipId from custom claims      │
│     *   - Load membership document                       │
│     *   - Extract organizationId, siteId, permissions    │
│     *   - Validate membership still active               │
│     *   - Return RequestContext object                   │
│     */                                                    │
│                                                           │
│    // RequestContext = {                                 │
│    //   authUserId: "firebase-uid-123",                  │
│    //   userId: "user-123",                              │
│    //   organizationId: "org-university-a", ✅          │
│    //   membershipId: "mem-001",                         │
│    //   siteId: "site-main-campus",                      │
│    //   role: "security_guard",                          │
│    //   permissions: ["incidents:read-all", ...],        │
│    //   isPlatformOperator: false                        │
│    // }                                                   │
│                                                           │
│    // 3. Authorize                                       │
│    authorize(context, { permission: 'incidents:create'});│
│                                                           │
│    // 4. Execute with tenant context                     │
│    const incident = {                                    │
│      organizationId: context.organizationId, ✅         │
│      siteId: context.siteId,                             │
│      userId: context.userId,                             │
│      type: request.data.type,                            │
│      location: request.data.location,                    │
│      // ❌ IGNORE any client-supplied organizationId    │
│    };                                                     │
│                                                           │
│    await db.collection('incidents').add(incident);       │
│    return incident;                                      │
│  }                                                        │
└───────────────────────────────────────────────────────────┘
```

---

## CROSS-TENANT ISOLATION (Phase 2)

```
UNIVERSITY A                    UNIVERSITY B
┌─────────────┐                ┌─────────────┐
│  Students   │                │  Students   │
│  Guards     │                │  Guards     │
│  Operators  │                │  Operators  │
└──────┬──────┘                └──────┬──────┘
       │                              │
       │ memberships:                 │ memberships:
       │ - orgId: "univ-a"           │ - orgId: "univ-b"
       │ - status: "active"          │ - status: "active"
       │                              │
       ↓                              ↓
┌──────────────────┐          ┌──────────────────┐
│ Firebase         │          │ Firebase         │
│ Functions        │          │ Functions        │
│                  │          │                  │
│ context =        │          │ context =        │
│   orgId: "a"     │          │   orgId: "b"     │
└────────┬─────────┘          └────────┬─────────┘
         │                              │
         │                              │
         ↓                              ↓
┌────────────────────────────────────────────────┐
│          Firestore Database                    │
│                                                │
│  incidents (filtered by organizationId)        │
│  ┌──────────────────┐  ┌──────────────────┐   │
│  │ org: "univ-a"    │  │ org: "univ-b"    │   │
│  │ site: "campus-a" │  │ site: "campus-b" │   │
│  │ status: "open"   │  │ status: "open"   │   │
│  └──────────────────┘  └──────────────────┘   │
│         ↑                        ↑             │
│         │                        │             │
│         │ ISOLATED               │ ISOLATED    │
│         │ No cross-access        │             │
│         │                        │             │
│  ✅ University A users can ONLY query         │
│     WHERE organizationId = "univ-a"           │
│                                                │
│  ✅ University B users can ONLY query         │
│     WHERE organizationId = "univ-b"           │
│                                                │
│  ❌ Client CANNOT supply organizationId       │
│                                                │
└────────────────────────────────────────────────┘
```

---

## MIGRATION STEPS SUMMARY

### Step 1: Add Membership Collection ✅
```typescript
memberships/{membershipId} {
  organizationId: string,
  userId: string,
  siteId: string,
  kind: MembershipKind,
  status: MembershipStatus,
  permissions: string[]
}
```

### Step 2: Migrate User Linking
- Create membership for each existing user
- Link to their `providerId` → `organizationId`
- Update custom claims with `activeMembershipId`

### Step 3: Implement Request Context
```typescript
async function buildRequestContext(uid: string): RequestContext {
  // 1. Get activeMembershipId from custom claims
  // 2. Load membership document
  // 3. Validate status = 'active'
  // 4. Extract organizationId, siteId, permissions
  // 5. Return context
}
```

### Step 4: Add Organization Fields to Incidents
```sql
-- Firestore schema update
incidents/{incidentId} {
  organizationId: string,  -- ✅ NEW (indexed)
  siteId: string,          -- ✅ NEW (indexed)
  zoneId?: string,         -- ✅ NEW
  // ... existing fields
}
```

### Step 5: Update All Functions
```typescript
// BEFORE
export const getNearbyIncidents = onCall(async req => {
  return await db.collection('incidents')
    .where('status', '==', 'open')
    .get();
});

// AFTER
export const getNearbyIncidents = onCall(async req => {
  const context = await buildRequestContext(req.auth.uid);
  authorize(context, { permission: 'incidents:read-all' });
  
  return await db.collection('incidents')
    .where('organizationId', '==', context.organizationId)
    .where('status', '==', 'open')
    .get();
});
```

### Step 6: Scope Push Notifications
```typescript
// BEFORE (UNSAFE)
const tokens = await db.collectionGroup('devices').get();

// AFTER (SAFE)
const tokens = await db
  .collectionGroup('devices')
  .where('organizationId', '==', incident.organizationId)
  .get();
```

### Step 7: Test Isolation
```typescript
// Cross-tenant test suite
it('University A user cannot see University B incidents', async () => {
  const userA = await signInAsUser('guard@univ-a.ac.za');
  const incidents = await getNearbyIncidents(userA.token);
  
  expect(incidents.every(
    inc => inc.organizationId === 'univ-a'
  )).toBe(true);
});
```

---

## DEPLOYMENT CHECKLIST

### Prerequisites
- [ ] Backup Firestore database
- [ ] Backup Realtime Database
- [ ] Create migration script
- [ ] Set up test environment with 2 organizations

### Phase 2A: Membership System
- [ ] Create `memberships` collection
- [ ] Implement membership creation on registration
- [ ] Backfill memberships for existing users
- [ ] Update custom claims with `activeMembershipId`
- [ ] Deploy and verify

### Phase 2B: Request Context
- [ ] Implement `buildRequestContext()`
- [ ] Implement `authorize()` function
- [ ] Define permission model
- [ ] Test context builder
- [ ] Deploy and verify

### Phase 2C: Data Migration
- [ ] Add `organizationId` to incidents (new incidents)
- [ ] Backfill `organizationId` for existing incidents
- [ ] Add composite indexes
- [ ] Update all query functions
- [ ] Deploy and verify

### Phase 2D: Notification Scoping
- [ ] Add `organizationId` to FCM token storage
- [ ] Update notification trigger
- [ ] Test notification isolation
- [ ] Deploy and verify

### Phase 2E: Testing
- [ ] Run cross-tenant test suite
- [ ] Manual testing with 2 test universities
- [ ] Performance testing (query indexes)
- [ ] Security audit
- [ ] Documentation review

### Phase 2F: Stop-Gate
- [ ] All tests passing
- [ ] Security review passed
- [ ] Documentation complete
- [ ] Stakeholder sign-off
- [ ] ✅ PHASE 2 COMPLETE

---

**Document**: Phase 2 Architecture Transformation  
**Visual Reference**: Current vs Target State  
**Next**: Phase 2 Implementation (begin with Membership System)
