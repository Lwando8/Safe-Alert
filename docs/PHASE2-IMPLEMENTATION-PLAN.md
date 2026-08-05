# PHASE 2 — IMPLEMENTATION PLAN

**Architecture Decision**: Clerk + Firebase Hybrid  
**Auth**: Clerk (Organizations + Memberships)  
**Storage**: Firebase Firestore  
**Functions**: Firebase Cloud Functions (Clerk token validation)

---

## ARCHITECTURAL APPROACH

### Current Stack
- ❌ Firebase Auth (custom claims, role-based)
- ✅ Firebase Firestore (data storage)
- ✅ Firebase Cloud Functions (API)
- ✅ React Native/Expo (mobile)
- ✅ Next.js 16 (web)

### Target Stack (Phase 2)
- ✅ **Clerk** (authentication, organizations, memberships)
- ✅ **Firebase Firestore** (data storage - keep)
- ✅ **Firebase Cloud Functions** (API - migrate to Clerk token validation)
- ✅ **React Native/Expo** (mobile - add `@clerk/expo`)
- ✅ **Next.js 16** (web - add `@clerk/nextjs`)

### Why Clerk?
1. **Native Organizations** - Built-in multi-tenant support
2. **Membership Management** - Roles, permissions, invitations out-of-the-box
3. **Enterprise Ready** - SSO, SAML, domain verification
4. **Excellent DX** - React Native, Next.js, and API support
5. **No User Management Code** - Sign-up, sign-in, profile management handled

### Why Keep Firebase?
1. **Data Storage** - Firestore already has our data model
2. **Real-time** - Location tracking uses Realtime Database
3. **Functions** - Existing API logic, just swap auth validation
4. **Notifications** - FCM infrastructure already set up
5. **Less Migration Risk** - Change auth, keep data layer

---

## IMPLEMENTATION PHASES

### Phase 2A: Clerk Setup & Authentication (Week 1-2)
1. Install Clerk in web and mobile apps
2. Enable Clerk Organizations
3. Create development organizations (University A, University B)
4. Migrate authentication flows
5. Set up organization switcher

### Phase 2B: Membership System (Week 2-3)
1. Create `memberships` Firestore collection
2. Sync Clerk org memberships to Firestore
3. Implement membership kind mapping (student, staff, guard, etc.)
4. Build membership validation helpers
5. Set up Clerk webhooks → Firebase sync

### Phase 2C: Firebase Functions Migration (Week 3-4)
1. Add Clerk token verification to Cloud Functions
2. Build `RequestContext` from Clerk session
3. Migrate all functions to use Clerk auth
4. Remove Firebase Auth dependencies
5. Update custom claims handling

### Phase 2D: Data Layer Tenant Scoping (Week 4-6)
1. Add `organizationId` to all collections
2. Backfill existing data
3. Create repository pattern with org filtering
4. Migrate all queries
5. Add composite indexes

### Phase 2E: Mobile App Integration (Week 5-6)
1. Install `@clerk/expo`
2. Replace Firebase Auth with Clerk
3. Add organization bootstrap flow
4. Update session management
5. Test organization switching

### Phase 2F: Testing & Verification (Week 7-8)
1. Cross-tenant isolation test suite
2. Two-university test environment
3. Security audit
4. Performance testing
5. Phase 2 stop-gate verification

---

## DETAILED IMPLEMENTATION STEPS

## STEP 1: Clerk Installation & Configuration

### 1.1 Install Clerk Packages

**Web App** (`apps/web`):
```bash
cd apps/web
npm install @clerk/nextjs @clerk/ui
```

**Mobile App** (root):
```bash
npm install @clerk/expo
npx expo install expo-secure-store expo-web-browser
```

**Shared Domain** (optional type safety):
```bash
cd packages/domain
npm install -D @clerk/types
```

### 1.2 Create Clerk Application

```bash
# Log in to Clerk
npx clerk auth login

# Create new Clerk application
npx clerk apps create "Seren SOS Platform" --json

# Enable Organizations
npx clerk enable orgs

# Link to project (store app_id)
npx clerk link --app app_xxx

# Pull environment variables
npx clerk env pull
```

### 1.3 Configure Clerk Organizations

**Dashboard Settings**:
- Membership mode: `Membership required` (B2B-only, no personal accounts)
- Max allowed memberships: `50` (per org)
- Admin delete: `Enabled`
- Verified domains: `Enabled` (for university SSO later)

**Custom Roles** (create in Dashboard → Organizations → Roles):
- `org:admin` (University Administrator)
- `org:supervisor` (Security Supervisor)
- `org:responder` (Security Guard)
- `org:staff` (University Staff)
- `org:student` (Student)

### 1.4 Environment Variables

**Web App** (`.env.local`):
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# Organization URLs
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/ops
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/ops
```

**Mobile App** (`.env`):
```bash
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
```

**Firebase Functions** (`firebase/functions/.env`):
```bash
CLERK_SECRET_KEY=sk_test_xxx
CLERK_PUBLISHABLE_KEY=pk_test_xxx
```

---

## STEP 2: Web App (Next.js) Clerk Integration

### 2.1 Root Layout with ClerkProvider

**File**: `apps/web/src/app/layout.tsx`

```typescript
import { ClerkProvider } from '@clerk/nextjs'
import { shadcn } from '@clerk/ui/themes'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider
          appearance={{ theme: shadcn }}
          dynamic
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  )
}
```

### 2.2 Middleware for Route Protection

**File**: `apps/web/src/middleware.ts`

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher(['/'])
const isPlatformRoute = createRouteMatcher(['/platform(.*)'])
const isOpsRoute = createRouteMatcher(['/ops(.*)'])

export default clerkMiddleware(async (auth, req) => {
  const { userId, orgId, orgRole, has } = await auth()

  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next()
  }

  // Require authentication
  if (!userId) {
    return auth().redirectToSignIn()
  }

  // Platform routes require platform admin
  if (isPlatformRoute(req)) {
    // Check for platform admin role (we'll set this via metadata)
    const session = await auth()
    const isPlatformAdmin = session.sessionClaims?.metadata?.platformAdmin === true
    
    if (!isPlatformAdmin) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }
  }

  // Ops routes require organization membership
  if (isOpsRoute(req)) {
    if (!orgId) {
      return NextResponse.redirect(new URL('/choose-organization', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

### 2.3 Organization Switcher in Navigation

**File**: `apps/web/src/components/shell-nav.tsx`

```typescript
import { OrganizationSwitcher } from '@clerk/nextjs'

export function ShellNav() {
  return (
    <nav>
      {/* Existing nav items */}
      
      <OrganizationSwitcher
        hidePersonal
        afterSelectOrganizationUrl="/ops"
        afterCreateOrganizationUrl="/ops"
        appearance={{
          elements: {
            rootBox: "flex items-center",
          }
        }}
      />
    </nav>
  )
}
```

### 2.4 Sign-In and Sign-Up Pages

**File**: `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx`

```typescript
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn 
        appearance={{
          elements: {
            rootBox: "shadow-lg",
            card: "bg-card",
          }
        }}
      />
    </div>
  )
}
```

**File**: `apps/web/src/app/sign-up/[[...sign-up]]/page.tsx`

```typescript
import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp 
        appearance={{
          elements: {
            rootBox: "shadow-lg",
            card: "bg-card",
          }
        }}
      />
    </div>
  )
}
```

---

## STEP 3: Mobile App (Expo) Clerk Integration

### 3.1 Root Component with ClerkProvider

**File**: `App.tsx`

```typescript
import { ClerkProvider, ClerkLoaded } from '@clerk/expo'
import * as SecureStore from 'expo-secure-store'
import { RootNavigator } from './src/navigation/RootNavigator'

// Token cache for Clerk
const tokenCache = {
  async getToken(key: string) {
    try {
      return SecureStore.getItemAsync(key)
    } catch (err) {
      return null
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value)
    } catch (err) {
      return
    }
  },
}

export default function App() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!

  if (!publishableKey) {
    throw new Error(
      'Missing Clerk Publishable Key. Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in .env'
    )
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ClerkLoaded>
        <RootNavigator />
      </ClerkLoaded>
    </ClerkProvider>
  )
}
```

### 3.2 Organization Bootstrap Flow

**File**: `src/screens/OrganizationBootstrapScreen.tsx`

```typescript
import { useOrganizationList, useAuth } from '@clerk/expo'
import { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native'

export function OrganizationBootstrapScreen({ navigation }) {
  const { setActive, isLoaded, userMemberships } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  })
  const { orgId } = useAuth()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // If already in an org, navigate away
    if (orgId) {
      navigation.replace('Home')
    }
  }, [orgId])

  const handleSelectOrganization = async (membership: any) => {
    if (!isLoaded) return
    
    setLoading(true)
    try {
      await setActive({ organization: membership.organization.id })
      navigation.replace('Home')
    } catch (err) {
      console.error('Error switching organization:', err)
    } finally {
      setLoading(false)
    }
  }

  if (!isLoaded || loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
        <Text className="mt-4">Loading organizations...</Text>
      </View>
    )
  }

  const activeMemberships = userMemberships.data?.filter(
    m => m.membership.role && m.publicUserData
  ) || []

  if (activeMemberships.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-xl font-bold mb-4">No Organization Access</Text>
        <Text className="text-center text-muted-foreground">
          You don't belong to any university yet. Contact your campus safety office to get access.
        </Text>
      </View>
    )
  }

  if (activeMemberships.length === 1) {
    // Auto-select single organization
    useEffect(() => {
      handleSelectOrganization(activeMemberships[0])
    }, [])
    
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" />
        <Text className="mt-4">Connecting to your university...</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 p-6">
      <Text className="text-2xl font-bold mb-2">Select University</Text>
      <Text className="text-muted-foreground mb-6">
        You belong to multiple universities. Choose one to continue:
      </Text>
      
      <FlatList
        data={activeMemberships}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            className="border border-border rounded-lg p-4 mb-3"
            onPress={() => handleSelectOrganization(item)}
          >
            <Text className="font-semibold text-lg">
              {item.organization.name}
            </Text>
            <Text className="text-sm text-muted-foreground mt-1">
              Role: {item.membership.role}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  )
}
```

### 3.3 Updated Root Navigator

**File**: `src/navigation/RootNavigator.tsx`

```typescript
import { useAuth } from '@clerk/expo'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SignInScreen } from '../screens/SignInScreen'
import { OrganizationBootstrapScreen } from '../screens/OrganizationBootstrapScreen'
// ... existing imports

const Stack = createNativeStackNavigator()

export function RootNavigator() {
  const { isLoaded, isSignedIn, orgId } = useAuth()

  if (!isLoaded) {
    return <LoadingScreen />
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isSignedIn ? (
          <>
            <Stack.Screen name="SignIn" component={SignInScreen} />
            <Stack.Screen name="SignUp" component={SignUpScreen} />
          </>
        ) : !orgId ? (
          <Stack.Screen 
            name="OrganizationBootstrap" 
            component={OrganizationBootstrapScreen} 
          />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            {/* ... other authenticated screens */}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
```

---

## STEP 4: Firestore Membership Collection

### 4.1 Membership Schema

**Collection**: `memberships/{membershipId}`

```typescript
interface Membership {
  id: string;                    // Firestore document ID
  clerkMembershipId: string;     // Clerk's organizationMembership.id
  clerkOrganizationId: string;   // Clerk's organization.id
  organizationId: string;         // Our internal org ID (derived from Clerk)
  userId: string;                 // Clerk user.id
  siteId: string;                 // Primary site assignment
  zoneIds?: string[];             // Zone assignments (responders)
  
  // Membership classification
  kind: 'student' | 'staff' | 'contractor' | 'security_guard' | 
        'control_room' | 'org_admin';
  
  // Status (mirrored from Clerk + our extensions)
  status: 'invited' | 'active' | 'suspended' | 'revoked';
  clerkRole: string;              // Clerk's org role (org:admin, org:responder, etc.)
  
  // Permissions (derived from role)
  permissions: string[];
  
  // Responder-specific fields
  responderProfile?: {
    unitCode?: string;
    responderType?: string;
    approvalStatus?: 'pending' | 'approved' | 'rejected' | 'revoked';
    employmentStatus?: 'active' | 'inactive';
    deviceBindingRequired?: boolean;
  };
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
  lastSeenAt?: number;
}
```

### 4.2 Membership Sync Service

**File**: `firebase/functions/src/services/MembershipSyncService.ts`

```typescript
import * as admin from 'firebase-admin';
import { Clerk } from '@clerk/clerk-sdk-node';

const clerk = Clerk({ secretKey: process.env.CLERK_SECRET_KEY });
const db = admin.firestore();

export class MembershipSyncService {
  /**
   * Sync Clerk organization membership to Firestore
   */
  static async syncMembership(clerkMembershipId: string) {
    // Get membership from Clerk
    const clerkMembership = await clerk.organizationMemberships.getOrganizationMembership({
      organizationMembershipId: clerkMembershipId,
    });
    
    const { organization, publicUserData } = clerkMembership;
    const clerkRole = clerkMembership.role;
    
    // Map Clerk role to our membership kind
    const kind = this.mapRoleToKind(clerkRole);
    
    // Derive permissions from role
    const permissions = this.derivePermissions(clerkRole, kind);
    
    // Check if membership already exists
    const existingSnap = await db
      .collection('memberships')
      .where('clerkMembershipId', '==', clerkMembershipId)
      .limit(1)
      .get();
    
    const membershipData: any = {
      clerkMembershipId,
      clerkOrganizationId: organization.id,
      organizationId: organization.slug, // Use slug as internal org ID
      userId: publicUserData.userId,
      kind,
      status: 'active',
      clerkRole,
      permissions,
      updatedAt: Date.now(),
    };
    
    if (existingSnap.empty) {
      // Create new membership
      const membershipRef = db.collection('memberships').doc();
      membershipData.id = membershipRef.id;
      membershipData.createdAt = Date.now();
      
      // Set default site (first site of organization)
      const sitesSnap = await db
        .collection('sites')
        .where('organizationId', '==', membershipData.organizationId)
        .limit(1)
        .get();
      
      if (!sitesSnap.empty) {
        membershipData.siteId = sitesSnap.docs[0].id;
      }
      
      await membershipRef.set(membershipData);
      return membershipRef.id;
    } else {
      // Update existing membership
      const membershipRef = existingSnap.docs[0].ref;
      await membershipRef.update(membershipData);
      return membershipRef.id;
    }
  }
  
  /**
   * Map Clerk role to membership kind
   */
  private static mapRoleToKind(clerkRole: string): string {
    const roleMap: Record<string, string> = {
      'org:admin': 'org_admin',
      'org:supervisor': 'control_room',
      'org:responder': 'security_guard',
      'org:staff': 'staff',
      'org:student': 'student',
    };
    
    return roleMap[clerkRole] || 'student';
  }
  
  /**
   * Derive permissions from role
   */
  private static derivePermissions(clerkRole: string, kind: string): string[] {
    const permissionMap: Record<string, string[]> = {
      'org:admin': [
        'incidents:create',
        'incidents:read-all',
        'incidents:assign',
        'incidents:update',
        'incidents:close',
        'responders:read',
        'responders:manage',
        'sites:read',
        'sites:manage',
        'memberships:read',
        'memberships:manage',
        'analytics:read',
        'audit:read',
        'organization:manage',
      ],
      'org:supervisor': [
        'incidents:create',
        'incidents:read-all',
        'incidents:assign',
        'incidents:update',
        'incidents:close',
        'responders:read',
        'sites:read',
        'analytics:read',
      ],
      'org:responder': [
        'incidents:read-all',
        'incidents:acknowledge',
        'incidents:update',
        'responders:read',
        'sites:read',
      ],
      'org:staff': [
        'incidents:create',
        'incidents:read-own',
        'sites:read',
      ],
      'org:student': [
        'incidents:create',
        'incidents:read-own',
        'sites:read',
      ],
    };
    
    return permissionMap[clerkRole] || ['incidents:create', 'incidents:read-own'];
  }
  
  /**
   * Revoke membership (soft delete)
   */
  static async revokeMembership(clerkMembershipId: string) {
    const membershipSnap = await db
      .collection('memberships')
      .where('clerkMembershipId', '==', clerkMembershipId)
      .limit(1)
      .get();
    
    if (!membershipSnap.empty) {
      await membershipSnap.docs[0].ref.update({
        status: 'revoked',
        updatedAt: Date.now(),
      });
    }
  }
}
```

---

## STEP 5: Firebase Functions with Clerk Auth

### 5.1 Clerk Token Verification

**File**: `firebase/functions/src/middleware/clerkAuth.ts`

```typescript
import { Clerk } from '@clerk/clerk-sdk-node';
import { HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const clerk = Clerk({ secretKey: process.env.CLERK_SECRET_KEY });
const db = admin.firestore();

export interface RequestContext {
  authUserId: string;           // Clerk user ID
  userId: string;                // Same as authUserId
  organizationId: string;        // Our internal org ID (slug)
  clerkOrganizationId: string;   // Clerk's org ID
  membershipId: string;          // Firestore membership doc ID
  siteId: string;                // Primary site
  role: string;                  // Membership kind
  clerkRole: string;             // Clerk org role
  permissions: string[];         // Derived permissions
  isPlatformOperator: boolean;   // Platform admin flag
}

/**
 * Build request context from Clerk session token
 */
export async function buildRequestContext(
  authorizationHeader?: string
): Promise<RequestContext> {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    throw new HttpsError('unauthenticated', 'Missing or invalid authorization header');
  }
  
  const token = authorizationHeader.substring(7);
  
  // Verify Clerk session token
  let session;
  try {
    session = await clerk.verifyToken(token, {
      authorizedParties: [process.env.CLERK_PUBLISHABLE_KEY!],
    });
  } catch (err) {
    throw new HttpsError('unauthenticated', 'Invalid session token');
  }
  
  const userId = session.sub;
  const orgId = session.org_id;
  const orgRole = session.org_role;
  
  if (!orgId || !orgRole) {
    throw new HttpsError('failed-precondition', 'User must belong to an organization');
  }
  
  // Get organization from Clerk
  const organization = await clerk.organizations.getOrganization({
    organizationId: orgId,
  });
  
  const organizationId = organization.slug;
  
  // Get membership from Firestore
  const membershipSnap = await db
    .collection('memberships')
    .where('userId', '==', userId)
    .where('organizationId', '==', organizationId)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  
  if (membershipSnap.empty) {
    throw new HttpsError(
      'failed-precondition',
      'No active membership found for this organization'
    );
  }
  
  const membership = membershipSnap.docs[0].data();
  
  // Check for platform admin (stored in user's public metadata)
  const user = await clerk.users.getUser(userId);
  const isPlatformOperator = user.publicMetadata?.platformAdmin === true;
  
  return {
    authUserId: userId,
    userId,
    organizationId,
    clerkOrganizationId: orgId,
    membershipId: membershipSnap.docs[0].id,
    siteId: membership.siteId,
    role: membership.kind,
    clerkRole: orgRole,
    permissions: membership.permissions || [],
    isPlatformOperator,
  };
}

/**
 * Authorize request against permission
 */
export function authorize(
  context: RequestContext,
  options: { permission: string } | { role: string }
) {
  if ('permission' in options) {
    if (!context.permissions.includes(options.permission)) {
      throw new HttpsError(
        'permission-denied',
        `Missing required permission: ${options.permission}`
      );
    }
  }
  
  if ('role' in options) {
    if (context.role !== options.role && !context.isPlatformOperator) {
      throw new HttpsError(
        'permission-denied',
        `Missing required role: ${options.role}`
      );
    }
  }
}
```

### 5.2 Updated Cloud Function Example

**File**: `firebase/functions/src/index.ts`

```typescript
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { buildRequestContext, authorize } from './middleware/clerkAuth';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

/**
 * Create incident (tenant-scoped)
 */
export const createIncident = onCall(async (request) => {
  // Build context from Clerk token
  const context = await buildRequestContext(
    request.rawRequest.headers.authorization
  );
  
  // Authorize
  authorize(context, { permission: 'incidents:create' });
  
  // Validate input
  const { type, location, zoneId, category, mode } = request.data;
  
  if (!type || !location?.latitude || !location?.longitude) {
    throw new HttpsError('invalid-argument', 'type and location required');
  }
  
  // Create incident with tenant context
  const incidentRef = db.collection('incidents').doc();
  const incident = {
    id: incidentRef.id,
    organizationId: context.organizationId,     // ✅ Server-authoritative
    siteId: context.siteId,                      // ✅ From membership
    zoneId: zoneId || null,
    userId: context.userId,
    type,
    category: category || null,
    mode: mode || 'standard',
    status: 'open',
    mapStatus: 'unassigned',
    location,
    lastLocation: location,
    assignments: [],
    meta: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  await incidentRef.set(incident);
  
  // Create timeline event
  await db.collection('incidents').doc(incidentRef.id)
    .collection('timeline').add({
      eventType: 'incident_created',
      incidentId: incidentRef.id,
      userId: context.userId,
      timestamp: Date.now(),
    });
  
  return incident;
});

/**
 * Get nearby incidents (tenant-scoped)
 */
export const getNearbyIncidents = onCall(async (request) => {
  const context = await buildRequestContext(
    request.rawRequest.headers.authorization
  );
  
  authorize(context, { permission: 'incidents:read-all' });
  
  // ✅ Query filtered by organization
  const incidentsSnap = await db
    .collection('incidents')
    .where('organizationId', '==', context.organizationId)
    .where('status', '==', 'open')
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();
  
  const incidents = incidentsSnap.docs.map(doc => doc.data());
  
  return { incidents };
});
```

---

## STEP 6: Clerk Webhooks → Firestore Sync

### 6.1 Configure Webhooks

**Dashboard**: https://dashboard.clerk.com/last-active?path=webhooks

Create webhook endpoint:
- URL: `https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/clerkWebhook`
- Events:
  - `organizationMembership.created`
  - `organizationMembership.updated`
  - `organizationMembership.deleted`
  - `organization.created`
  - `organization.updated`
  - `organization.deleted`

### 6.2 Webhook Handler Function

**File**: `firebase/functions/src/index.ts`

```typescript
import { onRequest } from 'firebase-functions/v2/https';
import { Webhook } from 'svix';
import { MembershipSyncService } from './services/MembershipSyncService';

export const clerkWebhook = onRequest(async (request, response) => {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  
  if (!WEBHOOK_SECRET) {
    throw new Error('Missing CLERK_WEBHOOK_SECRET');
  }
  
  // Verify webhook signature
  const svixHeaders = {
    'svix-id': request.headers['svix-id'] as string,
    'svix-timestamp': request.headers['svix-timestamp'] as string,
    'svix-signature': request.headers['svix-signature'] as string,
  };
  
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt;
  
  try {
    evt = wh.verify(JSON.stringify(request.body), svixHeaders);
  } catch (err) {
    console.error('Webhook verification failed:', err);
    response.status(400).json({ error: 'Invalid signature' });
    return;
  }
  
  const { type, data } = evt as any;
  
  try {
    switch (type) {
      case 'organizationMembership.created':
      case 'organizationMembership.updated':
        await MembershipSyncService.syncMembership(data.id);
        break;
      
      case 'organizationMembership.deleted':
        await MembershipSyncService.revokeMembership(data.id);
        break;
      
      case 'organization.created':
        // Optionally create organization record in Firestore
        console.log('Organization created:', data.id);
        break;
      
      case 'organization.deleted':
        // Handle organization deletion
        console.log('Organization deleted:', data.id);
        break;
    }
    
    response.json({ success: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    response.status(500).json({ error: 'Processing failed' });
  }
});
```

---

## STEP 7: Testing & Verification

### 7.1 Create Test Organizations

```bash
# University A
clerk api -X POST /v1/organizations \
  -d '{"name":"University A","slug":"university-a","max_allowed_memberships":100}'

# University B
clerk api -X POST /v1/organizations \
  -d '{"name":"University B","slug":"university-b","max_allowed_memberships":100}'
```

### 7.2 Create Test Users

```bash
# Create users via Dashboard or API
clerk api -X POST /v1/users \
  -d '{"email_address":["guard-a@test.com"],"password":"testpass123"}'

clerk api -X POST /v1/users \
  -d '{"email_address":["guard-b@test.com"],"password":"testpass123"}'
```

### 7.3 Add Memberships

```bash
# Add guard-a to University A
clerk api -X POST /v1/organizations/org_university_a/memberships \
  -d '{"user_id":"user_xxx","role":"org:responder"}'

# Add guard-b to University B
clerk api -X POST /v1/organizations/org_university_b/memberships \
  -d '{"user_id":"user_yyy","role":"org:responder"}'
```

### 7.4 Cross-Tenant Isolation Tests

**File**: `firebase/functions/src/test/cross-tenant.test.ts`

```typescript
import { expect } from 'chai';
import * as admin from 'firebase-admin';
import { buildRequestContext } from '../middleware/clerkAuth';

describe('Cross-Tenant Isolation', () => {
  it('User from University A cannot see University B incidents', async () => {
    // Sign in as University A guard
    const contextA = await buildRequestContext(guardAToken);
    
    // Query incidents
    const incidents = await db
      .collection('incidents')
      .where('organizationId', '==', contextA.organizationId)
      .get();
    
    // Verify all incidents belong to University A
    incidents.docs.forEach(doc => {
      expect(doc.data().organizationId).to.equal('university-a');
    });
  });
  
  it('Responder cannot spoof organizationId', async () => {
    const contextB = await buildRequestContext(guardBToken);
    
    // Attempt to create incident with different org ID
    const incidentRef = db.collection('incidents').doc();
    await incidentRef.set({
      organizationId: 'university-a', // ❌ Spoofed
      // ... rest of data
    });
    
    // Verify queries are still scoped
    const incidents = await db
      .collection('incidents')
      .where('organizationId', '==', contextB.organizationId)
      .get();
    
    // Should NOT include the spoofed incident
    const spoofed = incidents.docs.find(
      doc => doc.id === incidentRef.id
    );
    expect(spoofed).to.be.undefined;
  });
  
  it('Suspended membership is rejected', async () => {
    // Suspend membership in Firestore
    await db.collection('memberships')
      .doc(membershipId)
      .update({ status: 'suspended' });
    
    // Attempt to build context
    try {
      await buildRequestContext(suspendedUserToken);
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.message).to.include('No active membership');
    }
  });
});
```

---

## MIGRATION CHECKLIST

### Pre-Migration
- [ ] Back up Firestore database
- [ ] Back up Firebase Auth users
- [ ] Document all existing user accounts
- [ ] Create Clerk application
- [ ] Enable Clerk Organizations
- [ ] Set up development environment

### Web App
- [ ] Install `@clerk/nextjs`
- [ ] Add ClerkProvider to root layout
- [ ] Create middleware for route protection
- [ ] Add sign-in/sign-up pages
- [ ] Add OrganizationSwitcher component
- [ ] Test authentication flow
- [ ] Test organization switching

### Mobile App
- [ ] Install `@clerk/expo`
- [ ] Add ClerkProvider to App.tsx
- [ ] Create organization bootstrap screen
- [ ] Update root navigator
- [ ] Replace Firebase Auth calls with Clerk
- [ ] Test authentication flow
- [ ] Test organization selection

### Firebase Functions
- [ ] Install `@clerk/clerk-sdk-node`
- [ ] Create Clerk auth middleware
- [ ] Implement RequestContext builder
- [ ] Implement authorize() function
- [ ] Migrate all functions to use Clerk auth
- [ ] Remove Firebase Auth dependencies
- [ ] Deploy and test

### Data Layer
- [ ] Create memberships collection
- [ ] Add organizationId to incidents
- [ ] Add organizationId to all collections
- [ ] Create composite indexes
- [ ] Backfill existing data
- [ ] Test queries with organization filter

### Webhooks & Sync
- [ ] Create webhook endpoint
- [ ] Configure Clerk webhooks
- [ ] Implement membership sync service
- [ ] Test webhook delivery
- [ ] Verify Firestore sync

### Testing
- [ ] Create test organizations
- [ ] Create test users with memberships
- [ ] Run cross-tenant isolation tests
- [ ] Test notification scoping
- [ ] Test permission enforcement
- [ ] Security audit
- [ ] Performance testing

### Production Readiness
- [ ] Environment variables configured
- [ ] Webhook secrets secured
- [ ] Error handling comprehensive
- [ ] Logging implemented
- [ ] Monitoring set up
- [ ] Documentation updated
- [ ] Phase 2 verification report complete

---

## ROLLBACK PLAN

If migration fails:

1. **Keep Firebase Auth Active** during migration
2. **Run both systems** temporarily (add flag to toggle)
3. **Roll back** by switching flag back to Firebase Auth
4. **No data loss** - Firestore data remains unchanged

---

## SUCCESS CRITERIA

Phase 2 is complete when:

✅ Two test universities provisioned in Clerk  
✅ Web and mobile apps use Clerk authentication  
✅ Organization membership enforced server-side  
✅ All incidents have `organizationId`, `siteId`  
✅ All queries filtered by organization  
✅ Push notifications scoped to organization  
✅ Cross-tenant test suite passes  
✅ University A and B operate independently  
✅ No cross-tenant data leakage  
✅ Phase 2 verification report approved

---

**Next Steps**: Begin with Clerk installation (Step 1)
