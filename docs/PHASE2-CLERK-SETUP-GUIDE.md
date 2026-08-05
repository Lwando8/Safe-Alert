# PHASE 2 — CLERK SETUP GUIDE

**Quick Start Guide for Seren SOS Clerk Integration**

---

## PREREQUISITES

- Node.js 20.9.0 or higher
- npm or yarn
- Access to https://dashboard.clerk.com
- Firebase project with Firestore enabled

---

## STEP 1: CREATE CLERK APPLICATION

### Option A: Using Clerk CLI (Recommended)

```bash
# Log in to Clerk (opens browser for OAuth)
npx clerk auth login

# Create new Clerk application
npx clerk apps create "Seren SOS Platform" --json

# Output will include:
# {
#   "id": "app_2xxxxxxxxxxxxx",
#   "name": "Seren SOS Platform",
#   ...
# }
# Save the app_id for next steps
```

### Option B: Using Dashboard

1. Go to https://dashboard.clerk.com
2. Click "Add application"
3. Name: "Seren SOS Platform"
4. Click "Create application"
5. Copy the Application ID from settings

---

## STEP 2: ENABLE ORGANIZATIONS

### Using CLI

```bash
# Enable organizations for your app
npx clerk enable orgs

# This sets:
# - Organizations: Enabled
# - Membership mode: Membership required (B2B-only)
```

### Using Dashboard

1. Go to https://dashboard.clerk.com/~/organizations-settings
2. Toggle "Enable organizations" ON
3. Set "Membership mode" to **Membership required**
4. Save changes

---

## STEP 3: CREATE CUSTOM ROLES

Go to: https://dashboard.clerk.com/~/organizations-settings/roles

Create these 5 roles with their permissions:

### 1. University Administrator (`org:admin`)
**Permissions**:
- ✅ Manage organization profile
- ✅ Delete organization
- ✅ Manage organization membership
- ✅ Read organization membership
- ✅ Manage organization domains
- ✅ Read organization domains
- ✅ Manage organization billing (if using Clerk Billing)
- ✅ Read organization billing

**Custom Permissions** (add via Dashboard):
```
org:incidents:manage
org:responders:manage
org:campus:manage
org:analytics:read
```

### 2. Security Supervisor (`org:supervisor`)
**Permissions**:
- ✅ Read organization membership
- ✅ Read organization domains

**Custom Permissions**:
```
org:incidents:manage
org:responders:view
org:campus:view
org:analytics:read
```

### 3. Security Guard (`org:responder`)
**Permissions**:
- ✅ Read organization membership

**Custom Permissions**:
```
org:incidents:respond
org:responders:view
org:campus:view
```

### 4. University Staff (`org:staff`)
**Permissions**:
- None (default member)

**Custom Permissions**:
```
org:incidents:create
```

### 5. Student (`org:student`)
**Permissions**:
- None (default member)

**Custom Permissions**:
```
org:incidents:create
```

---

## STEP 4: LINK PROJECT AND GET KEYS

### Using CLI

```bash
# Link your Clerk app to this project
npx clerk link --app app_YOUR_APP_ID

# Pull environment variables
npx clerk env pull

# This creates/updates:
# - .env.local (for Next.js)
# Keys are automatically formatted correctly
```

### Manual Setup

If CLI doesn't work, get keys from Dashboard:

1. Go to https://dashboard.clerk.com/~/api-keys
2. Copy **Publishable Key** (starts with `pk_test_`)
3. Copy **Secret Key** (starts with `sk_test_`)

**⚠️ IMPORTANT**: Keep Secret Key private, never commit to git

---

## STEP 5: CONFIGURE ENVIRONMENT VARIABLES

### Web App (`apps/web/.env.local`)

```bash
# Clerk Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx

# Clerk URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/ops
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/ops
NEXT_PUBLIC_CLERK_AFTER_SELECT_ORGANIZATION_URL=/ops
NEXT_PUBLIC_CLERK_AFTER_CREATE_ORGANIZATION_URL=/ops

# Existing Firebase config (keep these)
# NEXT_PUBLIC_FIREBASE_API_KEY=...
# NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
# etc.
```

### Mobile App (`.env` in project root)

```bash
# Clerk Keys
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx

# Existing Firebase config (keep these)
# EXPO_PUBLIC_FIREBASE_API_KEY=...
# etc.
```

### Firebase Functions (`firebase/functions/.env`)

```bash
# Clerk Keys
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxx

# Webhook secret (we'll get this in Step 7)
CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
```

---

## STEP 6: CREATE TEST ORGANIZATIONS

### Using CLI

```bash
# Create University A
npx clerk api -X POST /v1/organizations \
  -d '{
    "name": "University A",
    "slug": "university-a",
    "max_allowed_memberships": 100,
    "created_by": "user_xxxxx"
  }'

# Create University B
npx clerk api -X POST /v1/organizations \
  -d '{
    "name": "University B",
    "slug": "university-b",
    "max_allowed_memberships": 100,
    "created_by": "user_xxxxx"
  }'
```

**Note**: Replace `user_xxxxx` with an actual user ID (create a user first or use your own)

### Using Dashboard

1. Go to https://dashboard.clerk.com/~/organizations
2. Click "Create organization"
3. Fill in:
   - Name: "University A"
   - Slug: "university-a"
   - Max members: 100
4. Repeat for University B

---

## STEP 7: CREATE TEST USERS

### Using CLI

```bash
# Create Guard for University A
npx clerk api -X POST /v1/users \
  -d '{
    "email_address": ["guard-a@test.com"],
    "password": "Test123!@#",
    "first_name": "Guard",
    "last_name": "Alpha"
  }'

# Output includes user_id, save it

# Add to University A as responder
npx clerk api -X POST /v1/organizations/org_xxxxx/memberships \
  -d '{
    "user_id": "user_xxxxx",
    "role": "org:responder"
  }'

# Repeat for University B
```

### Using Dashboard

1. Go to https://dashboard.clerk.com/~/users
2. Click "Create user"
3. Add email, password, name
4. After creation, go to Organizations tab
5. Add to organization with appropriate role

**Test Users to Create**:
- guard-a@test.com → University A → org:responder
- guard-b@test.com → University B → org:responder
- admin-a@test.com → University A → org:admin
- admin-b@test.com → University B → org:admin
- student-a@test.com → University A → org:student

---

## STEP 8: START WEB DEV SERVER

```bash
cd apps/web
npm run dev
```

Open http://localhost:3000

**Test Flow**:
1. Go to http://localhost:3000/sign-in
2. Sign in as guard-a@test.com
3. You should see organization selector
4. Select "University A"
5. You should land on /ops dashboard
6. Check that OrganizationSwitcher appears in nav

---

## STEP 9: VERIFY CLERK INTEGRATION

### Test Checklist

- [ ] Sign-in page loads at /sign-in
- [ ] Can sign in with test user
- [ ] Organization selector appears
- [ ] Can select University A
- [ ] Redirects to /ops after selection
- [ ] OrganizationSwitcher shows in navigation
- [ ] Can switch between organizations
- [ ] /platform routes are blocked (unauthorized)
- [ ] UserButton shows in navigation

---

## STEP 10: SET UP WEBHOOKS (Later)

**⚠️ Do this AFTER Firebase Functions are deployed**

1. Deploy Firebase Functions with webhook handler
2. Get the function URL: `https://REGION-PROJECT.cloudfunctions.net/clerkWebhook`
3. Go to https://dashboard.clerk.com/~/webhooks
4. Click "Add Endpoint"
5. URL: Your function URL
6. Events to subscribe:
   - `organizationMembership.created`
   - `organizationMembership.updated`
   - `organizationMembership.deleted`
   - `organization.created`
   - `organization.updated`
7. Copy the webhook secret
8. Add to `firebase/functions/.env`:
   ```bash
   CLERK_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx
   ```

---

## TROUBLESHOOTING

### "Organizations not enabled" error
**Fix**: Enable organizations in Dashboard → Organizations settings

### "Missing publishable key" error
**Fix**: Ensure `.env.local` has `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

### "User must belong to organization" error
**Fix**: Add user to an organization via Dashboard

### Web app shows white screen
**Fix**: 
1. Check browser console for errors
2. Verify all environment variables are set
3. Restart dev server after adding env vars

### Can't see organization switcher
**Fix**: 
1. Verify user belongs to at least one organization
2. Check that `showOrgSwitcher={true}` in layout
3. Ensure organizations are enabled in Clerk

### Middleware redirects in loop
**Fix**: 
1. Check middleware matcher config
2. Verify sign-in URLs are correct
3. Ensure public routes are configured

---

## NEXT STEPS AFTER SETUP

Once Clerk is working in the web app:

1. **Mobile App Integration**
   - Add ClerkProvider to App.tsx
   - Create organization bootstrap screen
   - Update navigation logic

2. **Firebase Functions Migration**
   - Deploy clerk auth middleware
   - Update all functions to use Clerk tokens
   - Test with Postman/Insomnia

3. **Firestore Membership Sync**
   - Deploy webhook handler
   - Test membership sync
   - Verify data in Firestore

4. **Data Migration**
   - Add organizationId to incidents
   - Update all queries
   - Test cross-tenant isolation

---

## USEFUL COMMANDS

```bash
# Check Clerk configuration
npx clerk doctor --json

# List all organizations
npx clerk api /v1/organizations

# List organization members
npx clerk api /v1/organizations/org_xxxxx/memberships

# Get user details
npx clerk api /v1/users/user_xxxxx

# Update organization
npx clerk api -X PATCH /v1/organizations/org_xxxxx \
  -d '{"name":"University A Updated"}'

# Remove user from organization
npx clerk api -X DELETE /v1/organizations/org_xxxxx/memberships/user_xxxxx
```

---

## RESOURCES

### Clerk Documentation
- Quickstart: https://clerk.com/docs/nextjs/getting-started/quickstart
- Organizations: https://clerk.com/docs/guides/organizations/overview
- API Reference: https://clerk.com/docs/reference/backend-api

### Seren SOS Documentation
- Phase 2 Plan: `docs/PHASE2-IMPLEMENTATION-PLAN.md`
- Architecture Inventory: `docs/PHASE2-TENANT-BOUNDARY-INVENTORY.md`
- Progress Tracker: `docs/PHASE2-PROGRESS.md`

### Support
- Clerk Discord: https://clerk.com/discord
- Clerk Dashboard: https://dashboard.clerk.com

---

**Last Updated**: 2026-08-05  
**Prerequisites**: All packages installed successfully  
**Estimated Setup Time**: 30-45 minutes
