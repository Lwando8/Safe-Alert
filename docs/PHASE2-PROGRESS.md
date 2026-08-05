# PHASE 2 — MEMBERSHIP SYSTEM IMPLEMENTATION PROGRESS

**Date Started**: 2026-08-05  
**Status**: IN PROGRESS — Phase 2B tenant-scoped backend landed (partially verified)

**Phase 2B stop-gate**: **partially verified** — migrated APIs enforce org via `RequestContext`; dual-auth bridge still enabled; mobile not on Clerk; automated cross-tenant suite deferred to 2D. See [PHASE2B-DUAL-AUTH-BRIDGE.md](./PHASE2B-DUAL-AUTH-BRIDGE.md).

---

## ✅ COMPLETED

### 1. Architectural Planning
- [x] Comprehensive Phase 2 implementation plan created
- [x] Clerk + Firebase hybrid architecture defined
- [x] Migration strategy documented
- [x] Stop-gate criteria established

### 2. Package Installation
- [x] `@clerk/nextjs` installed in web app
- [x] `@clerk/ui` installed for shadcn theme
- [x] `@clerk/expo` installed in mobile app
- [x] `expo-secure-store` and `expo-web-browser` installed
- [x] `@clerk/clerk-sdk-node` installed in Firebase Functions
- [x] `svix` installed for webhook verification

### 3. Environment Configuration
- [x] Environment variable templates created:
  - `apps/web/.env.local.example` (Next.js)
  - `.env.example` (Expo mobile)
  - `firebase/functions/.env.example` (Functions)
  - [x] `ALLOW_FIREBASE_AUTH_FALLBACK` + `MEMBERSHIP_BOOTSTRAP_SECRET` documented

### 4. Web App Authentication (Next.js)
- [x] ClerkProvider added to root layout
- [x] shadcn theme applied to Clerk components
- [x] shadcn CSS import added to globals.css
- [x] Middleware created for route protection
  - [x] Public routes configured
  - [x] Platform routes require admin role
  - [x] Ops routes require organization membership
- [x] Sign-in page created (`/sign-in`)
- [x] Sign-up page created (`/sign-up`)
- [x] Organization selection page (`/select-organization`)
- [x] Unauthorized page (`/unauthorized`)

### 5. Navigation Components
- [x] ShellNav updated with OrganizationSwitcher
- [x] UserButton integrated
- [x] University layout updated to show org switcher

---

### 6. Firebase Functions Middleware
- [x] Clerk auth middleware created (`buildRequestContext`)
- [x] Dual-auth `resolveRequestContext` (Clerk-first + Firebase legacy adapter) ✅ Phase 2B
- [x] Authorization helper created (`authorize` / `authorizeAnyPermission` / `requireTenantMatch`)
- [x] Request context includes `authProvider`
- [x] Token verification implemented
- [x] Membership validation from Firestore
- [x] `identityLinks` fail-closed resolver ✅ Phase 2B

### 7. Membership Sync Service
- [x] MembershipSyncService created
- [x] Role to kind mapping implemented
- [x] Permission derivation implemented
- [x] Sync membership function
- [x] Revoke membership function
- [x] Bulk sync organization members
- [x] `ensureOrganizationAndDefaultSite` ✅ Phase 2B

### 8. Setup Documentation
- [x] Comprehensive Clerk setup guide created
- [x] Step-by-step instructions for CLI
- [x] Dashboard setup instructions
- [x] Environment variable configuration
- [x] Test organization creation guide
- [x] Troubleshooting section
- [x] Dual-auth bridge + removal gate documented (`PHASE2B-DUAL-AUTH-BRIDGE.md`) ✅

---

## ✅ PHASE 2B COMPLETE (code)

### 12. Firebase Functions Migration (tenant surface)
- [x] Create Clerk auth middleware (`buildRequestContext`) ✅
- [x] Create authorization helper (`authorize`) ✅
- [x] Dual-auth bridge with `ALLOW_FIREBASE_AUTH_FALLBACK` ✅
- [x] Migrate `createIncident` function ✅
- [x] Migrate `getNearbyIncidents` function ✅
- [x] Migrate `appendIncidentLocation` / `acceptIncident` / `updateIncidentStatus` / `assignUnitToIncident` ✅
- [x] Migrate `registerPushToken` + org-scoped `onIncidentCreatedNotify` ✅
- [ ] Migrate remaining unmigrated callables (shifts/heartbeat/login*) — deferred
- [ ] Remove Firebase Auth dependencies — blocked on removal gate
- [ ] Deploy and test functions — operator step

### 13. Webhook Handler
- [x] MembershipSyncService created ✅
- [x] Create webhook endpoint function (`clerkWebhook`) ✅
- [x] Bootstrap callable (`bootstrapOrganizationMemberships`) ✅
- [x] Identity link callable (`linkIdentity`, Clerk/platform only) ✅
- [ ] Deploy webhook function — operator step
- [ ] Configure Clerk webhooks in Dashboard — operator step
- [ ] Test membership sync — operator step
- [ ] Test webhook delivery — operator step

### 14. Data Layer Tenant Scoping (incidents + push)
- [x] Add `organizationId` + `siteId` on incident create ✅
- [x] Composite indexes for org-scoped incident queries ✅
- [x] Update incident queries with org filter ✅
- [x] Add `organizationId` to FCM / `orgDevices` token index ✅
- [x] Update notification trigger with org filter ✅
- [ ] Backfill existing data (if any) — operator step

### 15. Testing & Verification (2B smoke, not full 2D)
- [x] Smoke script + verification matrix (`scripts/phase2b-smoke.ts`) ✅
- [x] Local policy assertions (cross-tenant deny) ✅
- [ ] Create two test organizations (University A, University B) — operator
- [ ] Create test users with memberships + identityLinks — operator
- [ ] Live cross-tenant isolation probes — operator / Phase 2D
- [ ] Automated cross-tenant suite — Phase 2D

---

## 🚧 IN PROGRESS

### 9. Package Installation
- [x] Firebase Functions packages installed
- [⚠️] Web packages installation (version conflict - needs resolution)
- [⚠️] Mobile packages installation (in progress)

---

## 📋 REMAINING WORK (post-2B)

### 10. Clerk Application Setup (Next Step)
- [ ] Create Clerk application via CLI
- [ ] Enable Organizations in Clerk Dashboard
- [ ] Set membership mode to "Membership required"
- [ ] Create custom roles (5 roles)
- [ ] Pull environment variables to `.env.local`
- [ ] Create test organizations (University A & B)
- [ ] Create test users with memberships

### 11. Mobile App Integration (Estimated: 1-2 days)
- [ ] Update `App.tsx` with ClerkProvider
- [ ] Create token cache with expo-secure-store
- [ ] Create OrganizationBootstrapScreen
- [ ] Update RootNavigator with org check
- [ ] Replace Firebase Auth calls with Clerk
- [ ] Test authentication flow
- [ ] Test organization selection
- [ ] **Then** execute Firebase fallback removal gate

### 16. Documentation & Handoff (Estimated: 1 day)
- [ ] Update API documentation
- [ ] Create setup guide for new developers
- [ ] Document membership lifecycle
- [ ] Document permission model
- [ ] Create Phase 2 verification report

---

## 📝 NEXT IMMEDIATE STEPS

### Step 1: Initialize Clerk Application
```bash
# Log in to Clerk
npx clerk auth login

# Create new application
npx clerk apps create "Seren SOS Platform" --json

# Output will include app_id (e.g., app_2xxx...)
```

### Step 2: Enable Organizations
```bash
# Enable organizations for the app
npx clerk enable orgs

# Link the app to your project
npx clerk link --app app_YOUR_APP_ID

# Pull environment variables
npx clerk env pull
```

### Step 3: Configure Roles in Dashboard
1. Go to https://dashboard.clerk.com/
2. Select your application
3. Navigate to Organizations → Roles & Permissions
4. Create the 5 custom roles listed above
5. Assign appropriate permissions to each role

### Step 4: Create Test Organizations
```bash
# Create University A
npx clerk api -X POST /v1/organizations \
  -d '{"name":"University A","slug":"university-a","max_allowed_memberships":100}'

# Create University B
npx clerk api -X POST /v1/organizations \
  -d '{"name":"University B","slug":"university-b","max_allowed_memberships":100}'
```

### Step 5: Copy Environment Variables
Copy the generated keys to:
- `apps/web/.env.local`
- `.env` (root, for mobile)
- `firebase/functions/.env`

---

## 🎯 PHASE 2 COMPLETION METRICS

### Web App ✅ (80% Complete)
- [x] Authentication flow
- [x] Route protection
- [x] Organization switcher
- [ ] Environment variables configured
- [ ] Production testing

### Mobile App ⚠️ (0% Complete)
- [ ] ClerkProvider setup
- [ ] Organization bootstrap
- [ ] Navigation update
- [ ] Authentication migration
- [ ] Testing

### Firebase Functions ✅ (Phase 2B surface complete)
- [x] Clerk token verification
- [x] Dual-auth `resolveRequestContext` + Firebase legacy adapter
- [x] Migrated incident + push callables
- [x] Webhook handler (`clerkWebhook`) + bootstrap
- [ ] Live deploy / operator probes
- [ ] Remove Firebase fallback (removal gate)

### Data Layer ✅ (Phase 2B incidents + push)
- [x] Membership collection schema + Admin-only rules
- [x] Organization ID on incidents
- [x] Query filtering by organizationId
- [x] Notification scoping via `orgDevices`
- [ ] Live backfill / production verification

**Overall Progress**: ~55% Complete (Phase 2B code complete; stop-gate: partially verified)

---

## 🔧 DEVELOPMENT COMMANDS

```bash
# Functions
cd firebase/functions
npm run build
npm run smoke:phase2b
npm run smoke:phase2b:checklist
```

See also: [`PHASE2B-DUAL-AUTH-BRIDGE.md`](./PHASE2B-DUAL-AUTH-BRIDGE.md)

### Start Web Development Server
```bash
cd apps/web
npm run dev
# Access at http://localhost:3000
```

### Start Mobile Development
```bash
npm run start
# Press 'i' for iOS simulator
# Press 'a' for Android emulator
# Scan QR code for physical device
```

### Firebase Functions Development
```bash
npm run firebase:emulators
# Functions available at http://localhost:5001
```

### Deploy Firebase Functions (when ready)
```bash
cd firebase/functions
npm run build
firebase deploy --only functions
```

---

## ⚠️ IMPORTANT NOTES

### Do Not Deploy Yet
The system is NOT tenant-safe until ALL Phase 2 work is complete:
- Mobile app must use Clerk authentication
- Firebase Functions must validate Clerk tokens
- All data must be tenant-scoped
- Cross-tenant tests must pass

### Testing Strategy
1. Create two test organizations in Clerk
2. Create test users in each organization
3. Verify users can only see their organization's data
4. Test notification scoping
5. Test permission enforcement
6. Run automated test suite

### Firebase Auth Migration
- Keep Firebase Auth active during development
- Can run dual auth temporarily if needed
- Full cutover only after testing complete
- Have rollback plan ready

---

## 📞 GETTING HELP

### Clerk Resources
- Dashboard: https://dashboard.clerk.com
- Documentation: https://clerk.com/docs
- Discord: https://clerk.com/discord

### Firebase Resources
- Console: https://console.firebase.google.com
- Documentation: https://firebase.google.com/docs

### Project Documentation
- Phase 2 Plan: `docs/PHASE2-IMPLEMENTATION-PLAN.md`
- Architecture Inventory: `docs/PHASE2-TENANT-BOUNDARY-INVENTORY.md`
- Executive Summary: `docs/PHASE2-EXECUTIVE-SUMMARY.md`

---

**Last Updated**: 2026-08-05  
**Next Review**: After Clerk setup complete  
**Estimated Completion**: 2-3 weeks from start
