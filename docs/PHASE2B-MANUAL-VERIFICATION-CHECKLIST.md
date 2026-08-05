# Phase 2B — Manual Verification Checklist

## Automated (required before claiming partial/full verification)

```bash
cd firebase/functions
npm test
npm run build
npm run smoke:phase2b
```

## Emulator Firebase path

```bash
# Terminal 1
./node_modules/.bin/firebase emulators:start --only firestore,auth \
  --config firebase/firebase.json --project demo-seren

# Terminal 2
cd firebase/functions
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren npm run seed:phase2b
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren npm run probe:phase2b
```

Expected probe IDs all `ok: true`:

- [x] `create-stamp`
- [x] `read-a`
- [x] `cross-tenant-read`
- [x] `cross-tenant-write-guard`
- [x] `permission-deny`
- [x] `suspended-membership`
- [x] `push-isolation`
- [x] `fallback-disable`

### Manual ops UI (when Clerk + emulator available)

1. Set `apps/web/.env.local` with real Clerk keys + `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`
2. Seed fixtures (`seed:phase2b`)
3. Sign in as University A supervisor mapped to `user_clerk_a`
4. Open `http://localhost:3000/ops/incidents` — see only University A incidents
5. Attempt `/api/ops/incidents?organizationId=university-b` — still returns A only
6. Switch org / sign out — prior incidents cleared
7. Suspend membership in Firestore → expect membership inactive error

## Clerk path (external credentials)

When Clerk keys **are** available:

```bash
# 1. Configure apps/web/.env.local and firebase/functions/.env
# 2. Deploy or tunnel clerkWebhook; set CLERK_WEBHOOK_SECRET
# 3. Create University A/B orgs + memberships in Clerk
# 4. Bootstrap memberships:
#    bootstrapOrganizationMemberships({ clerkOrganizationId, bootstrapSecret })
# 5. Sign in via /sign-in, select org, open /ops/incidents
# 6. Revoke membership in Clerk → webhook → retry ops list → denied
# 7. Confirm Authorization: Bearer <Clerk JWT> on callable createIncident
#    and that Firebase fallback is not used when Clerk JWT is valid
```

When Clerk keys **are not** available: mark Clerk path **externally blocked**. Do not claim Clerk verification.

## Push registration

- [x] Emulator fixtures register distinct tokens under `orgDevices/{org}/tokens`
- [ ] Physical iOS/Android device registration (removal-gate blocker)

## Platform surfaces

- [x] Code: `linkIdentity` / bootstrap disallow Firebase fallback
- [ ] Live `/platform/*` Clerk-only check with platformAdmin metadata
