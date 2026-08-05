# PHASE 2 — MEMBERSHIP SYSTEM IMPLEMENTATION PROGRESS

**Date Started**: 2026-08-05  
**Status**: IN PROGRESS — Web App Foundation Complete

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
- [x] Authorization helper created (`authorize`)
- [x] Request context type defined
- [x] Token verification implemented
- [x] Membership validation from Firestore

### 7. Membership Sync Service
- [x] MembershipSyncService created
- [x] Role to kind mapping implemented
- [x] Permission derivation implemented
- [x] Sync membership function
- [x] Revoke membership function
- [x] Bulk sync organization members

### 8. Setup Documentation
- [x] Comprehensive Clerk setup guide created
- [x] Step-by-step instructions for CLI
- [x] Dashboard setup instructions
- [x] Environment variable configuration
- [x] Test organization creation guide
- [x] Troubleshooting section

---

## 🚧 IN PROGRESS

### 9. Package Installation
- [x] Firebase Functions packages installed
- [⚠️] Web packages installation (version conflict - needs resolution)
- [⚠️] Mobile packages installation (in progress)

---

## 📋 REMAINING WORK

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

### 12. Firebase Functions Migration (Estimated: 2-3 days)
- [x] Create Clerk auth middleware (`buildRequestContext`) ✅
- [x] Create authorization helper (`authorize`) ✅
- [ ] Migrate `createIncident` function
- [ ] Migrate `getNearbyIncidents` function
- [ ] Migrate all remaining functions
- [ ] Remove Firebase Auth dependencies
- [ ] Deploy and test functions

### 13. Webhook Handler (Estimated: 1 day)
- [x] MembershipSyncService created ✅
- [ ] Create webhook endpoint function
- [ ] Deploy webhook function
- [ ] Configure Clerk webhooks in Dashboard
- [ ] Test membership sync
- [ ] Test webhook delivery

### 14. Data Layer Tenant Scoping (Estimated: 2-3 days)
- [ ] Add `organizationId` to incidents collection
- [ ] Add `siteId` and `zoneId` to incidents
- [ ] Create composite indexes
- [ ] Update incident queries with org filter
- [ ] Add `organizationId` to FCM tokens
- [ ] Update notification trigger with org filter
- [ ] Backfill existing data (if any)

### 15. Testing & Verification (Estimated: 2-3 days)
- [ ] Create two test organizations (University A, University B)
- [ ] Create test users with memberships
- [ ] Write cross-tenant isolation tests
- [ ] Test notification scoping
- [ ] Test permission enforcement
- [ ] Performance testing
- [ ] Security audit

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

### Firebase Functions ⚠️ (0% Complete)
- [ ] Clerk token verification
- [ ] Request context builder
- [ ] Function migration
- [ ] Webhook handler
- [ ] Testing

### Data Layer ⚠️ (0% Complete)
- [ ] Membership collection
- [ ] Organization ID on incidents
- [ ] Query filtering
- [ ] Notification scoping
- [ ] Testing

**Overall Progress**: ~35% Complete

---

## 🔧 DEVELOPMENT COMMANDS

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
