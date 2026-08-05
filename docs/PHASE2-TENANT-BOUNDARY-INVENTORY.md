# PHASE 2 — ARCHITECTURAL INSPECTION AND TENANT-BOUNDARY INVENTORY

**Document Version**: 1.1  
**Date**: 2026-08-05  
**Status**: Updated after Phase 2B tenant incident verification slice

---

## EXECUTIVE SUMMARY (updated)

Phase 2B has moved the **migrated incident + push surface** and **`/ops/incidents`** onto server-authoritative `organizationId` resolution (Clerk-preferred, Firebase legacy adapter). Emulator isolation for University A/B passes.

### Critical Finding (remaining)

**Production multi-university onboarding is still not safe.** Unmigrated callables, client Firestore rules, RTDB paths, and the Firebase Auth mobile bridge remain. Classification: **tenant-safe but partially verified** for the 2B slice only.

### Architecture Status (post-2B slice)

- **Domain Types**: ✅ Tenant-scoped with `organizationId`
- **Authentication**: ⚠️ Dual-auth bridge (Clerk preferred; Firebase legacy)
- **Authorization (migrated APIs)**: ✅ Membership + permission + tenant match
- **Authorization (unmigrated APIs)**: ❌ Still Firebase claims / global
- **Data Persistence (callable Admin path)**: ✅ Org-filtered incidents/tokens
- **Data Persistence (client rules)**: ❌ Still role-based, not org-filtered
- **API Layer (migrated)**: ✅ Tenant-scoped
- **`/ops/incidents`**: ✅ Wired to membership-scoped reads
- **Push Notifications (migrated trigger)**: ✅ `orgDevices/{organizationId}/tokens`
- **Route Protection (web)**: ✅ Clerk middleware for ops/platform when keys present

> Historical sections below describe the pre-2B baseline. Prefer `PHASE2B-IMPLEMENTATION-NOTES.md` and `PHASE2B-STOP-GATE-REPORT.md` for current enforcement details.

---

## 1. CURRENT ARCHITECTURE OVERVIEW

### 1.1 Technology Stack

**Mobile Application** (React Native + Expo)
- Platform: iOS/Android
- State: AsyncStorage (local)
- Auth: Firebase Authentication
- Database: Firestore + Realtime Database
- Functions: Firebase Cloud Functions (europe-west1)
- Notifications: Expo Push Notifications + FCM

**Web Application** (Next.js 16)
- Framework: Next.js 16.3.0 (App Router)
- UI: shadcn/ui + Tailwind CSS
- Monorepo: npm workspaces
- Shared Package: `@seren/domain`

**Backend Services** (Firebase)
- Auth: Firebase Authentication with custom claims
- Database: Cloud Firestore (documents)
- Realtime: Realtime Database (location tracking)
- Functions: Cloud Functions v2
- Notifications: Firebase Cloud Messaging

### 1.2 Monorepo Structure

```
/
├── packages/
│   └── domain/          # ✅ Shared domain types (tenant-aware)
├── apps/
│   └── web/            # ⚠️ Next.js dashboard (no auth yet)
├── src/                # Mobile app (React Native)
│   ├── services/       # ❌ API clients (not tenant-scoped)
│   ├── screens/        # Mobile UI
│   └── types/          # Mobile-specific types
├── firebase/
│   └── functions/      # ❌ Cloud Functions (not tenant-scoped)
└── responder-app/      # Legacy responder docs
```

---

## 2. DOMAIN MODEL ANALYSIS

### 2.1 Tenant-Scoped Types (✅ Ready)

The `@seren/domain` package already defines tenant-aware types with proper `organizationId` fields:

**Organizations**
```typescript
Organization {
  id: string
  name: string
  slug: string
  status: 'active' | 'suspended' | 'provisioning'
  settings?: OrganizationSettings
}
```

**Sites (Campus)**
```typescript
Site {
  id: string
  organizationId: string  // ✅ Tenant-scoped
  name: string
  slug: string
  timezone?: string
  status: 'active' | 'inactive'
  bounds?: SiteBounds
}
```

**Zones (Buildings)**
```typescript
Zone {
  id: string
  organizationId: string  // ✅ Tenant-scoped
  siteId: string
  name: string
  kind: 'building' | 'geofence' | 'response_zone' | 'other'
  geometry?: ZoneGeometry
}
```

**Memberships**
```typescript
Membership {
  id: string
  organizationId: string  // ✅ Tenant-scoped
  siteId?: string
  userId: string
  kind: 'student' | 'staff' | 'contractor' | 'security_guard' | 'control_room' | 'org_admin'
  status: 'invited' | 'active' | 'suspended' | 'revoked'
  permissions?: string[]
}
```

**Responders**
```typescript
Responder {
  id: string
  organizationId: string  // ✅ Tenant-scoped
  siteId: string
  zoneIds?: string[]
  userId: string
  membershipId: string
  unitCode: string
  responderType: string
  approvalStatus: 'pending' | 'approved' | 'rejected' | 'revoked'
  employmentStatus: 'active' | 'inactive'
}
```

**Incidents**
```typescript
TenantScopedIncident {
  id: string
  organizationId: string  // ✅ Tenant-scoped
  siteId: string
  zoneId?: string
  userId: string
  type: string
  category?: string
  status: 'open' | 'resolved' | 'cancelled'
  location: GeoPoint
  assignments?: unknown[]
}
```

**Notifications**
```typescript
NotificationRecord {
  id: string
  organizationId: string  // ✅ Tenant-scoped
  siteId?: string
  userId: string
  channel: 'push' | 'sms' | 'email' | 'in_app'
  kind: string
}
```

**Audit Events**
```typescript
AuditEvent {
  id: string
  organizationId?: string  // ✅ Nullable for platform actions
  siteId?: string
  actorUserId: string
  action: string
  resourceType: string
  resourceId: string
  timestamp: number
}
```

### 2.2 Custom Claims Structure

The domain defines expected auth claims:
```typescript
SerenAuthClaims {
  role?: string
  organizationId?: string  // ⚠️ Not consistently populated
  siteIds?: string[]
  membershipIds?: string[]
  unitId?: string
  platformAdmin?: boolean
}
```

**Status**: Type is defined but NOT used throughout the codebase.

---

## 3. AUTHENTICATION LAYER ANALYSIS

### 3.1 Current Implementation

**Location**: `src/services/AuthService.ts`

**Auth Provider**: Firebase Authentication

**Sign-In Flows**:
1. `loginCitizen(email, password)` — Regular users
2. `loginResponderUnit(loginId, password)` — Security guards
3. `loginAdmin(email, password)` — Dispatch/admin users

### 3.2 Custom Claims (⚠️ Insufficient)

**Current Claims** (set by Firebase Functions):
```typescript
// Citizen
await auth.setCustomUserClaims(uid, { 
  role: 'CITIZEN' 
});

// Responder
await auth.setCustomUserClaims(uid, {
  role: 'RESPONDER_UNIT',
  unitId: responderUnitId,
  organizationId: unit.organizationId || null  // ⚠️ Optional
});

// Admin
await auth.setCustomUserClaims(uid, {
  role: 'DISPATCHER' | 'SUPER_ADMIN'
});
```

### 3.3 Session Structure

**Mobile Session**:
```typescript
AuthSession {
  token: string
  user: {
    id: string
    email: string
    role: 'client' | 'responder' | 'admin'
    appRole: 'CITIZEN' | 'RESPONDER_UNIT' | 'DISPATCHER' | 'SUPER_ADMIN'
    name: string
    phone?: string
    providerId?: string  // ⚠️ Not validated
  }
  unit?: ResponderUnitSession
  activeShift?: ShiftSession
}
```

### 3.4 User Profile Storage

**Collection**: `users/{uid}`
```typescript
{
  id: string
  email: string
  fullName: string
  phone?: string
  providerId?: string  // ⚠️ Not linked to Organization
  responderUnitId?: string
  createdAt: number
  updatedAt: number
}
```

**⚠️ Problem**: No `organizationId` or `membershipId` in user profile.

### 3.5 Responder Unit Storage

**Collection**: `responderUnits/{unitId}`
```typescript
{
  loginId: string
  unitCode: string
  password: string  // ⚠️ Plain text password
  organizationId?: string  // ⚠️ Optional
  responderType: string
  authEmail?: string
  active: boolean
  vehicleRegistration?: string
}
```

**⚠️ Problems**:
- Passwords stored in plain text
- No link to Membership model
- Organization is optional

### 3.6 Admin Storage

**Collection**: `admins/{email}`
```typescript
{
  email: string
  password: string  // ⚠️ Plain text password
  name?: string
  role: 'DISPATCHER' | 'SUPER_ADMIN'
}
```

**⚠️ Problems**:
- Passwords in plain text
- No organization association
- No distinction between platform admin and university admin

### 3.7 Tenant Context Resolution

**Current Approach**: Client provides `providerId` hint
```typescript
// In EmergencyDispatchService.ts
async function resolveProviderId(): Promise<string | undefined> {
  const userJson = await AsyncStorage.getItem('user');
  const parsed = JSON.parse(userJson);
  return parsed?.providerId || parsed?.armedResponseProviderId;
}
```

**❌ CRITICAL**: Tenant context is CLIENT-AUTHORITATIVE, not server-validated.

---

## 4. AUTHORIZATION LAYER ANALYSIS

### 4.1 Current Implementation

**Location**: `firebase/functions/src/index.ts`

**Authorization Functions**:
```typescript
function requireAuth(ctx) {
  if (!ctx.auth) throw new HttpsError('unauthenticated', '...');
}

function role(ctx): string {
  return String(ctx.auth?.token?.role || 'CITIZEN');
}

function requireRole(ctx, allowed: string[], message) {
  const r = role(ctx);
  if (!allowed.includes(r)) throw new HttpsError('permission-denied', message);
}
```

### 4.2 Permission Checks

**Current checks are ROLE-BASED ONLY**:
- `CITIZEN` — can create incidents
- `RESPONDER_UNIT` — can accept incidents, send heartbeats
- `DISPATCHER`, `SUPER_ADMIN` — can assign units

**❌ NO ORGANIZATION BOUNDARY CHECKS**

### 4.3 Example Unsafe Function

```typescript
export const getNearbyIncidents = onCall(async req => {
  requireAuth(req);
  requireRole(req, ['RESPONDER_UNIT', 'DISPATCHER', 'SUPER_ADMIN']);
  
  // ❌ Returns ALL open incidents regardless of organization
  const list = await db
    .collection('incidents')
    .where('status', '==', 'open')
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();
  
  return { incidents: list.docs.map(d => d.data()) };
});
```

**❌ CRITICAL**: Any authenticated responder can see ALL incidents from ALL organizations.

---

## 5. DATA PERSISTENCE ANALYSIS

### 5.1 Firestore Collections

**Current Collections**:
```
users/{uid}
admins/{email}
responderUnits/{unitId}
shifts/{shiftId}
incidents/{incidentId}
  └─ timeline/{eventId}
operationalDevices/{deviceId}
fcmTokens/{userId}/devices/{deviceId}
```

### 5.2 Organization Scoping Status

| Collection | Has organizationId | Filtered Queries | Status |
|------------|-------------------|------------------|---------|
| `users` | ❌ No | ❌ No | Unsafe |
| `responderUnits` | ⚠️ Optional | ❌ No | Unsafe |
| `incidents` | ⚠️ Missing | ❌ No | **CRITICAL** |
| `shifts` | ❌ No | ❌ No | Unsafe |
| `fcmTokens` | ❌ No | ❌ No | Unsafe |
| `operationalDevices` | ❌ No | ❌ No | Unsafe |

### 5.3 Incident Schema (Current)

```typescript
// Stored in Firestore
{
  id: string
  type: 'sos' | 'medical' | 'security'
  status: 'open' | 'resolved' | 'cancelled'
  mapStatus: 'unassigned' | 'dispatched' | 'resolved'
  userId: string
  providerId?: string  // ⚠️ Client-supplied, not validated
  location: { latitude, longitude }
  lastLocation: { latitude, longitude }
  assignments: Assignment[]
  meta: Record<string, unknown>
  createdAt: number
  updatedAt: number
}
```

**❌ CRITICAL GAPS**:
- No `organizationId` field
- No `siteId` field
- No `zoneId` field
- Client-supplied `providerId` used without validation

### 5.4 Realtime Database Usage

**Path**: `incidentTracks/{incidentId}/points`

```typescript
await rtdb.ref(`incidentTracks/${incidentId}/points`).push({
  lat: location.latitude,
  lng: location.longitude,
  t: now(),
  uid: userId
});
```

**Path**: `liveUnits/{unitCode}`

```typescript
await rtdb.ref(`liveUnits/${unitCode}`).set({
  lat: location?.latitude ?? null,
  lng: location?.longitude ?? null,
  status: string,
  lastSeenAt: number,
  uid: string
});
```

**❌ CRITICAL**: No organization scoping in realtime database paths.

---

## 6. API LAYER ANALYSIS

### 6.1 Firebase Cloud Functions

**Functions Inventory**:

| Function | Auth Required | Tenant Check | Status |
|----------|---------------|--------------|---------|
| `registerCitizen` | ❌ No | ❌ No | Public |
| `loginResponder` | ❌ No | ⚠️ Partial | Unsafe |
| `loginAdmin` | ❌ No | ❌ No | Unsafe |
| `createIncident` | ✅ Yes | ❌ No | **CRITICAL** |
| `appendIncidentLocation` | ✅ Yes | ⚠️ Partial | Unsafe |
| `getNearbyIncidents` | ✅ Yes | ❌ No | **CRITICAL** |
| `acceptIncident` | ✅ Yes | ❌ No | **CRITICAL** |
| `updateIncidentStatus` | ✅ Yes | ❌ No | **CRITICAL** |
| `assignUnitToIncident` | ✅ Yes | ❌ No | **CRITICAL** |
| `unitHeartbeat` | ✅ Yes | ❌ No | Unsafe |
| `registerPushToken` | ✅ Yes | ❌ No | Unsafe |
| `startShift` | ✅ Yes | ❌ No | Unsafe |
| `endShift` | ✅ Yes | ❌ No | Unsafe |

### 6.2 Critical Unsafe Functions

**`createIncident`** — Creates incident without organizationId
```typescript
export const createIncident = onCall(async req => {
  requireAuth(req);
  requireRole(req, ['CITIZEN']);
  
  const { type, location, providerId, meta } = req.data || {};
  
  const incident = {
    id: incidentId,
    type: String(type),
    status: 'open',
    mapStatus: 'unassigned',
    userId: req.auth!.uid,
    providerId: providerId || null,  // ⚠️ Client-supplied
    location,
    lastLocation: location,
    createdAt: now(),
    updatedAt: now(),
    assignments: [],
    meta: meta || {},
  };
  
  await db.doc(`incidents/${incidentId}`).set(incident);
  // ❌ No organizationId, siteId, or zoneId
});
```

**`getNearbyIncidents`** — Returns all incidents
```typescript
export const getNearbyIncidents = onCall(async req => {
  requireAuth(req);
  requireRole(req, ['RESPONDER_UNIT', 'DISPATCHER', 'SUPER_ADMIN']);
  
  // ❌ No organization filtering
  const list = await db
    .collection('incidents')
    .where('status', '==', 'open')
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();
  
  return { incidents: list.docs.map(d => d.data()) };
});
```

**`acceptIncident`** — No ownership check
```typescript
export const acceptIncident = onCall(async req => {
  requireAuth(req);
  requireRole(req, ['RESPONDER_UNIT']);
  
  const { incidentId } = req.data || {};
  const ref = db.doc(`incidents/${incidentId}`);
  const snap = await ref.get();
  
  // ❌ No check if incident belongs to responder's organization
  const unitId = String(req.auth!.token.unitId || '');
  // ... assigns unit to incident
});
```

### 6.3 Firestore Trigger

**`onIncidentCreatedNotify`** — Broadcasts to ALL devices
```typescript
export const onIncidentCreatedNotify = onDocumentCreated(
  'incidents/{incidentId}',
  async event => {
    const incident = event.data?.data();
    
    // ❌ CRITICAL: Queries ALL tokens across ALL organizations
    const tokenSnap = await db
      .collectionGroup('devices')
      .where('token', '!=', null)
      .limit(1000)
      .get();
    
    const tokens = tokenSnap.docs
      .map(docSnap => docSnap.data().token)
      .filter(Boolean);
    
    // ❌ Sends notification to EVERYONE
    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: `New ${incident.type.toUpperCase()} alert`,
        body: `Incident ${incident.id} created`,
      },
      data: { incidentId: incident.id, event: 'incident_created' },
    });
  }
);
```

---

## 7. MOBILE APPLICATION ANALYSIS

### 7.1 State Management

**Storage**: AsyncStorage (device local storage)

**Cached Keys**:
- `AUTH_TOKEN_KEY` — Firebase ID token
- `USER_SESSION_KEY` — Full session object
- `USER_ROLE_KEY` — User role
- `RESPONDER_PROFILE_KEY` — Responder profile
- `ACTIVE_SHIFT_KEY` — Current shift
- `isAuthenticated` — Boolean flag
- `user` — User profile (includes `providerId`)

### 7.2 Tenant Context (❌ Client-Side)

**In `EmergencyDispatchService.ts`**:
```typescript
async function resolveProviderId(): Promise<string | undefined> {
  try {
    const userJson = await AsyncStorage.getItem('user');
    if (!userJson) return undefined;
    const parsed = JSON.parse(userJson);
    return parsed?.providerId || parsed?.armedResponseProviderId;
  } catch {
    return undefined;
  }
}
```

**In `DispatchApi.ts`**:
```typescript
export async function createAlert(
  type: AlertType,
  location: { latitude: number; longitude: number },
  options?: { providerId?: string; meta?: Record<string, any> }
): Promise<AlertResponse> {
  const fn = callable('createIncident');
  const res = await fn({
    type,
    location,
    providerId: options?.providerId,  // ⚠️ Client-supplied
    meta: options?.meta,
  });
  return res.data;
}
```

**❌ CRITICAL**: `providerId` is client-authoritative and can be spoofed.

### 7.3 Bootstrap Flow (Current)

1. User launches app
2. Firebase auth state listener fires
3. If authenticated:
   - Load cached session from AsyncStorage
   - Navigate to role-based home screen
4. No organization selection
5. No membership validation
6. No tenant context establishment

**❌ Missing**:
- Organization membership check
- Active membership validation
- Organization selection (if multiple)
- Tenant-scoped data preloading

### 7.4 Responder Flow (Current)

1. Guard enters `loginId` and password
2. `loginResponder` Cloud Function finds unit by `loginId`
3. Function returns email, creates/updates user
4. Session contains `unitId` in custom claims
5. Guard can see ALL open incidents
6. Guard can accept ANY incident

**❌ No organization boundary enforcement**

---

## 8. PUSH NOTIFICATION ANALYSIS

### 8.1 Token Registration

**Mobile**: `NotificationService.ts`
```typescript
private async registerForPushNotifications() {
  const token = await Notifications.getExpoPushTokenAsync();
  this.expoPushToken = token.data;
  
  await AsyncStorage.setItem('expoPushToken', this.expoPushToken);
  
  const register = callable('registerPushToken');
  await register({
    deviceId: Device.osBuildId || 'unknown-device',
    token: this.expoPushToken,
  });
}
```

**Cloud Function**:
```typescript
export const registerPushToken = onCall(async req => {
  requireAuth(req);
  const { deviceId, token } = req.data || {};
  
  // ❌ No organizationId stored
  await db.doc(`fcmTokens/${req.auth!.uid}/devices/${deviceId}`).set({
    token: String(token),
    updatedAt: now(),
  });
  
  return { ok: true };
});
```

### 8.2 Notification Broadcast (❌ Unsafe)

```typescript
// ❌ Queries ALL tokens from ALL users across ALL organizations
const tokenSnap = await db
  .collectionGroup('devices')
  .where('token', '!=', null)
  .limit(1000)
  .get();

const tokens = tokenSnap.docs
  .map(docSnap => docSnap.data().token)
  .filter(Boolean);

// ❌ Sends to EVERYONE
await admin.messaging().sendEachForMulticast({
  tokens,
  notification: { title: '...', body: '...' },
  data: { incidentId: incident.id },
});
```

**❌ CRITICAL**: A responder from University A receives notifications for incidents at University B.

---

## 9. WEB APPLICATION ANALYSIS

### 9.1 Route Structure

**University Operations** (`/ops/*`):
- `/ops` — Dashboard (placeholder)
- `/ops/incidents` — Incident command
- `/ops/responders` — Responder management
- `/ops/campus` — Sites and zones
- `/ops/broadcasts` — Campus messaging
- `/ops/analytics` — Reports
- `/ops/settings` — Configuration

**Platform Administration** (`/platform/*`):
- `/platform` — Platform dashboard
- `/platform/organizations` — Tenant provisioning
- `/platform/audit` — Cross-tenant audit
- `/platform/flags` — Feature flags
- `/platform/health` — System health

### 9.2 Authentication Status

**Current State**: ❌ No authentication implemented

The web app currently has:
- ✅ Route structure defined
- ✅ Layout components
- ✅ shadcn/ui components
- ❌ No auth provider
- ❌ No session management
- ❌ No route protection
- ❌ No tenant context

### 9.3 Data Fetching

**Current State**: ❌ No data fetching implemented

Placeholder pages exist but don't connect to Firebase or any backend.

---

## 10. TENANT BOUNDARY VIOLATIONS

### 10.1 Critical Cross-Tenant Leaks

**1. Incident Visibility**
- ❌ Any responder can query ALL incidents from ALL universities
- ❌ No organization filtering in `getNearbyIncidents`
- ❌ Responder from University A sees University B incidents on map

**2. Incident Assignment**
- ❌ Responder from University A can accept incident from University B
- ❌ Dispatcher from University A can assign responders to University B incidents
- ❌ No ownership validation in `acceptIncident`

**3. Push Notifications**
- ❌ New incident triggers notification to ALL devices globally
- ❌ Responder from University A receives alerts for University B
- ❌ No organization scoping in FCM token queries

**4. Location Tracking**
- ❌ Realtime Database paths have no organization prefix
- ❌ Any authenticated user can access `incidentTracks/{incidentId}`
- ❌ Any authenticated user can view `liveUnits/{unitCode}`

**5. User Data**
- ❌ No link between users and organizations
- ❌ User can claim any `providerId` without validation
- ❌ No membership model enforced

### 10.2 Spoofing Vectors

**Client can spoof tenant identity**:
```typescript
// Mobile client
const response = await createAlert('sos', location, {
  providerId: 'university-b-id',  // ⚠️ User from University A
  meta: { source: 'mobile-app' },
});
```

**Server accepts without validation**:
```typescript
// Firebase Function
const incident = {
  // ...
  providerId: req.data.providerId || null,  // ❌ Trusted
  // No organizationId from membership
};
```

---

## 11. MISSING COMPONENTS

### 11.1 Membership System

**Status**: ❌ Not Implemented

**Required**:
- `memberships` Firestore collection
- Membership creation on user registration
- Active membership validation on sign-in
- Organization selection flow (if multiple memberships)
- Membership status enforcement (suspended, revoked)

### 11.2 Authoritative Tenant Context

**Status**: ❌ Not Implemented

**Required**:
```typescript
type RequestContext = {
  authUserId: string;
  userId: string;
  organizationId: string;
  membershipId: string;
  role: MembershipRole;
  permissions: Permission[];
  isPlatformOperator: boolean;
};
```

### 11.3 Permission System

**Status**: ❌ Not Implemented

**Required permissions** (from Phase 2 plan):
- `incidents:create`
- `incidents:read-own`
- `incidents:read-all`
- `incidents:acknowledge`
- `incidents:assign`
- `incidents:update`
- `incidents:close`
- `responders:read`
- `responders:manage`
- `sites:read`
- `sites:manage`
- `memberships:read`
- `memberships:manage`
- `analytics:read`
- `audit:read`
- `organization:manage`

### 11.4 Organization Configuration

**Status**: ❌ Not Implemented

**Required** (from Phase 2 plan):
```typescript
type UniversityConfiguration = {
  organizationId: string;
  displayName: string;
  shortName?: string;
  logoUrl?: string;
  supportPhone?: string;
  emergencyInstructions?: string;
  primarySiteId?: string;
  incidentCategories: IncidentCategory[];
  enabledFeatures: FeatureFlag[];
};
```

### 11.5 Tenant-Scoped Repositories

**Status**: ❌ Not Implemented

**Required**: Repository pattern with explicit organization context
```typescript
interface IncidentRepository {
  create(context: RequestContext, data: CreateIncidentInput): Promise<Incident>;
  getById(context: RequestContext, incidentId: string): Promise<Incident>;
  getByOrganization(organizationId: string, filters?: Filters): Promise<Incident[]>;
  // ❌ FORBIDDEN: getAllIncidents() without organization parameter
}
```

### 11.6 Audit Trail

**Status**: ⚠️ Timeline events exist but incomplete

**Current**: `incidents/{id}/timeline/{eventId}` captures some events

**Missing**:
- Centralized audit collection
- Cross-resource audit queries
- Tenant attribution for all actions
- Platform admin action logging
- Support access logging

---

## 12. SECURITY RISKS

### 12.1 High Severity

**H1: Cross-Tenant Incident Access**
- Any authenticated responder can view incidents from any university
- No authorization boundary between organizations
- Impact: Privacy violation, operational confusion, legal liability

**H2: Unauthorized Incident Assignment**
- Responder from University A can accept/update incidents from University B
- No ownership validation
- Impact: Response coordination failure, safety risk

**H3: Global Push Notification Broadcast**
- New incident notifies ALL devices across ALL universities
- No organization filtering
- Impact: Alert fatigue, false alarms, privacy violation

**H4: Client-Authoritative Tenant Identity**
- Mobile client provides `providerId` without server validation
- User can spoof organization membership
- Impact: Data integrity compromise, cross-tenant pollution

**H5: Unauthenticated Web Routes**
- `/ops/*` and `/platform/*` routes have no authentication
- No session management
- Impact: Unauthorized access when web auth is added

### 12.2 Medium Severity

**M1: Plain-Text Passwords**
- Responder and admin passwords stored in plain text in Firestore
- No password hashing
- Impact: Credential exposure if database is compromised

**M2: No Session Revocation**
- Firebase tokens cached in AsyncStorage
- No membership revocation enforcement
- User with revoked membership can continue using app until token expires

**M3: Realtime Database Paths Unscoped**
- `incidentTracks/{id}` and `liveUnits/{code}` have no organization prefix
- Any authenticated user can access any tracking data
- Impact: Location privacy violation

**M4: FCM Token Storage Without Context**
- Device tokens stored without organization association
- Can't selectively notify users from specific university
- Impact: Incorrect notification targeting

### 12.3 Low Severity

**L1: No User Input Validation**
- Firebase Functions accept client data without schema validation
- Type coercion only (`String(...)`)
- Impact: Data integrity issues

**L2: Hardcoded Function Region**
- Functions deployed to `europe-west1` only
- No multi-region support
- Impact: Higher latency for non-European users

---

## 13. COMPLIANCE AND PRIVACY CONCERNS

### 13.1 POPIA/GDPR Implications

**Data Minimization**: ❌ Violated
- Responders see incidents from organizations they don't belong to
- Location data accessible across organizational boundaries

**Purpose Limitation**: ❌ Violated
- User data from University A can be queried by University B responders
- No technical enforcement of data usage boundaries

**Data Subject Rights**: ⚠️ At Risk
- No clear data controller/processor boundary between universities
- Cross-tenant data access makes deletion/export complex

### 13.2 University Contracts

**Typical Requirements**:
- "Student safety data must not be shared with other institutions"
- "Only authorized campus security may access incident details"
- "Location tracking limited to active incidents and authorized responders"

**Current Compliance**: ❌ None of these can be guaranteed

---

## 14. TECHNICAL DEBT

### 14.1 Architecture Debt

**Public-Style Assumptions**:
- System designed for single-tenant public safety
- `providerId` treated as hint, not boundary
- Global incident pool expected

**Migration Effort**: High
- Require schema changes to all core collections
- All Cloud Functions need rewrite
- Mobile state management needs refactor

### 14.2 Code Debt

**Type Inconsistencies**:
- Domain types define `TenantScopedIncident` but not used
- Mobile uses `DispatchAlert` without organization fields
- Mismatch between domain model and runtime schema

**Service Layer**:
- Direct Firestore queries scattered across mobile app
- No repository abstraction
- Tight coupling to Firebase SDK

---

## 15. PHASE 2 IMPLEMENTATION PRIORITIES

### 15.1 Critical Path (Must Do First)

**Priority 1: Membership System**
1. Create `memberships` Firestore collection
2. Link users to organizations on registration
3. Populate membership for existing users
4. Implement membership validation in auth flow

**Priority 2: Request Context**
1. Create authoritative `RequestContext` builder
2. Extract `organizationId` from membership, not client
3. Inject context into all Cloud Functions
4. Enforce context requirement

**Priority 3: Incident Schema Migration**
1. Add `organizationId`, `siteId`, `zoneId` to incidents
2. Backfill existing incidents (if any)
3. Update all incident creation/query functions
4. Add organization filtering to all queries

**Priority 4: Push Notification Scoping**
1. Add `organizationId` to FCM token storage
2. Rewrite notification trigger to filter by organization
3. Test notification isolation

### 15.2 High Priority (Phase 2 Gate)

**Priority 5: Authorization Layer**
1. Implement centralized `authorize()` function
2. Define permission model
3. Map membership kinds to permissions
4. Enforce in all protected functions

**Priority 6: Mobile Bootstrap**
1. Add organization membership loading on sign-in
2. Handle zero/one/multiple memberships
3. Add organization selection UI
4. Cache active organization securely
5. Clear cache on sign-out/switch

**Priority 7: Repository Pattern**
1. Create repository interfaces
2. Enforce organization parameter
3. Migrate direct queries to repositories
4. Remove global query methods

**Priority 8: Route Protection (Web)**
1. Implement Next.js authentication
2. Protect `/ops/*` routes (university roles only)
3. Protect `/platform/*` routes (platform roles only)
4. Add session middleware

### 15.3 Medium Priority (Hardening)

**Priority 9: Realtime Database Scoping**
1. Prefix paths with `{organizationId}/`
2. Migrate incident tracks
3. Migrate live unit positions
4. Update security rules

**Priority 10: Admin/Responder Security**
1. Hash passwords (migrate from plain text)
2. Implement secure credential storage
3. Add password reset flow
4. Remove password fields from Firestore documents

**Priority 11: Audit Enhancement**
1. Create centralized `auditEvents` collection
2. Log all tenant-crossing actions
3. Log platform admin access
4. Add audit query endpoints

### 15.4 Testing Requirements

**Cross-Tenant Isolation Tests** (must pass before Phase 2 gate):
1. User from University A cannot query University B incidents
2. Responder from University A cannot accept University B incident
3. Dispatcher from University A cannot assign responder to University B incident
4. New incident at University A does not notify University B devices
5. Client-supplied `providerId` cannot override membership-derived organization
6. Suspended membership is rejected on API calls
7. Revoked membership prevents sign-in
8. Organization switch clears cached incident data
9. Repository queries require organizationId parameter
10. Platform routes reject university-role tokens

---

## 16. RECOMMENDED ARCHITECTURE

### 16.1 Firestore Schema (Target State)

```
organizations/{orgId}
  ├─ settings (embedded)
  └─ sites (subcollection)

sites/{siteId}
  └─ zones (subcollection)

users/{userId}
  └─ profile (embedded)

memberships/{membershipId}
  ├─ organizationId (indexed)
  ├─ userId (indexed)
  ├─ siteId
  ├─ kind
  ├─ status
  └─ permissions[]

responders/{responderId}
  ├─ organizationId (indexed)
  ├─ siteId (indexed)
  ├─ userId (indexed)
  ├─ membershipId
  └─ approval/employment status

incidents/{incidentId}
  ├─ organizationId (indexed) ✅ NEW
  ├─ siteId (indexed) ✅ NEW
  ├─ zoneId ✅ NEW
  ├─ userId
  ├─ type, status, location
  ├─ assignments[]
  └─ timeline (subcollection)

shifts/{shiftId}
  ├─ organizationId (indexed) ✅ NEW
  ├─ responderUnitId
  └─ timestamps

fcmTokens/{userId}/devices/{deviceId}
  ├─ token
  ├─ organizationId (indexed) ✅ NEW
  └─ environment

auditEvents/{eventId}
  ├─ organizationId (indexed, nullable)
  ├─ actorUserId
  ├─ action, resourceType, resourceId
  └─ timestamp
```

### 16.2 Realtime Database Schema (Target State)

```
{organizationId}/
  incidentTracks/
    {incidentId}/
      points/ [...]
  liveUnits/
    {unitCode}/ { lat, lng, status, lastSeenAt }
```

### 16.3 Custom Claims (Target State)

```typescript
{
  role: 'CITIZEN' | 'RESPONDER_UNIT' | 'DISPATCHER' | 'ORG_ADMIN',
  
  // University membership
  activeMembershipId: string,
  organizationId: string,
  siteIds: string[],
  permissions: string[],
  
  // Responder-specific
  unitId?: string,
  
  // Platform access
  platformAdmin?: boolean,
  platformRole?: 'support' | 'operator' | 'admin'
}
```

### 16.4 Cloud Function Pattern (Target State)

```typescript
export const createIncident = onCall(async req => {
  // 1. Authenticate
  requireAuth(req);
  
  // 2. Build context (server-authoritative)
  const context = await buildRequestContext(req.auth!.uid);
  
  // 3. Authorize
  authorize(context, { permission: 'incidents:create' });
  
  // 4. Validate input
  const input = validateCreateIncidentInput(req.data);
  
  // 5. Execute with tenant context
  const incident = await IncidentRepository.create(context, {
    organizationId: context.organizationId,  // ✅ From membership
    siteId: input.siteId || context.primarySiteId,
    zoneId: input.zoneId,
    userId: context.userId,
    type: input.type,
    location: input.location,
  });
  
  // 6. Audit
  await AuditRepository.log(context, 'incident_created', incident.id);
  
  return incident;
});
```

---

## 17. STOP-GATE CRITERIA

Phase 2 implementation is complete ONLY when ALL of the following pass:

### 17.1 Functional Requirements

- [ ] Every user has explicit organization membership
- [ ] All incidents have `organizationId`, `siteId`, `zoneId`
- [ ] All queries filter by organization
- [ ] Push notifications are organization-scoped
- [ ] Membership status is enforced (active only)
- [ ] Organization switch clears cached data
- [ ] Responder eligibility checks membership

### 17.2 Security Requirements

- [ ] Cross-tenant test suite passes (10+ tests)
- [ ] No global incident queries remain
- [ ] Client-supplied `organizationId` is rejected
- [ ] Platform routes require platform role
- [ ] University routes require organization membership
- [ ] Audit trail captures all tenant-crossing attempts

### 17.3 Code Quality

- [ ] Repository pattern enforced
- [ ] No direct Firestore queries in business logic
- [ ] Authorization centralized
- [ ] Request context injected consistently
- [ ] Type safety maintained (domain types used)

### 17.4 Documentation

- [ ] API documentation updated with tenant requirements
- [ ] Mobile bootstrap flow documented
- [ ] Membership lifecycle documented
- [ ] Permission model documented
- [ ] Support runbook includes tenant verification steps

### 17.5 Verification Checklist

**Can provision second test university?** [ ]  
**Can user switch between test universities safely?** [ ]  
**Do isolation tests pass in automated suite?** [ ]  
**Have all passwords been hashed?** [ ]  
**Is realtime database scoped by organization?** [ ]  
**Are FCM tokens organization-tagged?** [ ]  
**Phase 2 verification report produced?** [ ]

---

## 18. CONCLUSION

### Current State

The Seren SOS codebase is architecturally sound at the **type/domain level** but **completely unsafe at the runtime level** for multi-tenant university deployment.

### Key Strengths

- ✅ Excellent domain model (`@seren/domain`)
- ✅ Clean monorepo structure
- ✅ Modern tech stack (Next.js 16, React Native, Firebase)
- ✅ Responsive design system

### Critical Gaps

- ❌ No tenant isolation enforcement
- ❌ No membership system
- ❌ No server-authoritative tenant context
- ❌ Cross-tenant data leakage in all APIs
- ❌ Broadcast push notifications
- ❌ Client-authoritative organization identity

### Phase 2 Scope

Phase 2 is **mandatory** and **cannot be skipped**. It is the foundation for all subsequent phases.

**Estimated Effort**: 6-8 weeks for a single experienced developer

**Risk**: High complexity due to pervasive architectural changes

**Success Criteria**: Two test universities can operate safely without cross-tenant leakage

---

## APPENDIX A: FILE INVENTORY

### A.1 Mobile Application

**Authentication**
- `src/services/AuthService.ts` — Firebase auth, session management
- `src/services/firebase/app.ts` — Firebase initialization
- `src/services/firebase/functions.ts` — Callable function wrapper

**API Clients**
- `src/services/ApiClient.ts` — HTTP client (deprecated, proxied)
- `src/services/DispatchApi.ts` — Incident creation, updates
- `src/services/EmergencyDispatchService.ts` — SOS alert flow
- `src/services/ResponderService.ts` — Responder operations
- `src/services/NotificationService.ts` — Push notifications
- `src/services/AdminService.ts` — Admin operations
- `src/services/CommunityService.ts` — Community features

**Types**
- `src/types/auth.ts` — Auth session, user, roles
- `src/types/dispatch.ts` — Incidents, assignments, responders

### A.2 Backend (Firebase)

**Cloud Functions**
- `firebase/functions/src/index.ts` — All callable functions

**Configuration**
- `firebase/firebase.json` — Firebase project config
- `firebase/firestore.rules` — Firestore security rules (not inspected)
- `firebase/firestore.indexes.json` — Query indexes

### A.3 Web Application

**Domain Package**
- `packages/domain/src/index.ts` — Shared types

**Next.js App**
- `apps/web/src/app/(university)/` — University operations routes
- `apps/web/src/app/(platform)/` — Platform admin routes
- `apps/web/src/components/` — UI components

### A.4 Documentation

- `docs/DOMAIN-MODEL.md` — Domain model specification
- `docs/DISPATCH-ARCHITECTURE.md` — Dispatch architecture
- `docs/IMPLEMENTATION-ROADMAP.md` — Phase delivery plan
- `docs/RISKS-PHASE1.md` — Phase 1 risks
- `docs/REUSE-VS-CHANGE.md` — Architectural decisions

---

## APPENDIX B: GLOSSARY

**Organization**: A university or institution using Seren SOS (tenant)  
**Site**: A campus within an organization  
**Zone**: A building or area within a site  
**Membership**: User's association with an organization  
**Responder**: Authorized security guard  
**Incident**: SOS alert or emergency event  
**Tenant**: Same as organization  
**RequestContext**: Server-side authenticated + authorized session state  
**Custom Claims**: Firebase Auth JWT custom fields  
**providerId**: Legacy field, client-supplied organization hint (unsafe)

---

**Document Status**: Ready for Phase 2 Implementation Planning  
**Next Step**: Review with technical lead, then begin Priority 1 (Membership System)
