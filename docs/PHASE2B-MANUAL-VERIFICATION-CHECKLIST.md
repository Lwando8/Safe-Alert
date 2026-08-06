# Phase 2B — Manual Verification Checklist

## Automated (required before claiming partial/full verification)

```bash
cd firebase/functions
npm test
npm run build
npm run smoke:phase2b
npm run preflight:clerk   # ready | externally_blocked (does not claim verification)
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
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren npm run probe:phase2d
```

Expected probe IDs all `ok: true` (2B + 2D write-path probes).

### Manual ops UI (when Clerk + emulator available)

1. Set `apps/web/.env.local` with real Clerk keys + `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`
2. Seed fixtures (`seed:phase2b`)
3. Sign in as University A supervisor mapped to `user_clerk_a`
4. Open `http://localhost:3000/ops/incidents` — see only University A incidents
5. Attempt `/api/ops/incidents?organizationId=university-b` — still returns A only
6. Switch org / sign out — prior incidents cleared (ops tenant boundary remounts)
7. Suspend membership in Firestore → expect membership inactive error

## Clerk path (external credentials)

Record results as `PASS` / `FAIL` / `BLOCKED`.

### Preflight

```bash
cd firebase/functions
# Load functions .env if present, then:
npm run preflight:clerk
```

| Check | Result | Notes |
|---|---|---|
| `preflight:clerk` status | **ready** (2026-08-06) | See `PHASE2B-LIVE-CLERK-EVIDENCE.md` |
| Web `.env.local` pk_/sk_ | **PASS** | Present (gitignored) |
| Functions `CLERK_SECRET_KEY` | **PASS** | Present + deployed |
| `CLERK_WEBHOOK_SECRET` | **PASS** | Rotated to Svix endpoint `c1Vc2T`; redeployed |

### Live steps (only when preflight = ready)

```bash
# 1. Configure apps/web/.env.local and firebase/functions/.env
# 2. Deploy or tunnel clerkWebhook; set CLERK_WEBHOOK_SECRET in Clerk Dashboard
#    Events: organizationMembership.created/updated/deleted, organization.created/updated
# 3. Create University A/B orgs + memberships in Clerk (custom roles)
# 4. Set platformAdmin=true on a platform user publicMetadata
# 5. Bootstrap memberships:
#    bootstrapOrganizationMemberships({ clerkOrganizationId, bootstrapSecret })
# 6. Sign in via /sign-in, select org, open /ops/incidents
# 7. GET /api/ops/incidents?organizationId=university-b → still session org only
# 8. Revoke membership in Clerk → webhook → retry ops list → denied
# 9. Callable createIncident with Authorization: Bearer <Clerk JWT>
#    Confirm authProvider=clerk (Firebase fallback not used when Clerk JWT valid)
# 10. Non-platformAdmin user → /platform → /unauthorized
# 11. Signed-in user without org → /ops → /select-organization
```

| Step | Result | Evidence |
|---|---|---|
| Sign-in + org select | **PASS** | Clerk ticket sign-in; University A active |
| `/ops/incidents` tenant list | **PASS** | Empty list for university-a (no credential errors) |
| Org ID spoof ignored | **PASS** | `/api/ops/incidents?organizationId=university-b` → `organizationId:"university-a"` |
| Membership revoke | **PASS (webhook→Firestore)** | `organizationMembership.deleted` → status `revoked`; recreate → new active membership |
| Clerk JWT on callable | PENDING | Needs signed-in session JWT probe |
| `/platform` admin-only | **PASS** | Ops A → `/unauthorized`; platformAdmin → `/platform` |
| `/ops` requires org | **PASS** | Code guards + live org scoping |

When Clerk keys **are not** available: mark Clerk path **externally blocked**. Do not claim Clerk verification.

**Agent environment (2026-08-06):** Clerk path **`ready`** with live webhook sync + **UI walkthrough PASS** — see [`PHASE2B-LIVE-CLERK-EVIDENCE.md`](./PHASE2B-LIVE-CLERK-EVIDENCE.md) and [`PHASE2B-UI-WALKTHROUGH-2026-08-06.txt`](./PHASE2B-UI-WALKTHROUGH-2026-08-06.txt).

## Push registration

- [x] Emulator fixtures register distinct tokens under `orgDevices/{org}/tokens`
- [ ] Physical iOS/Android device registration (removal-gate blocker)

## Platform surfaces

- [x] Code: `linkIdentity` / bootstrap disallow Firebase fallback
- [x] Code: middleware + platform soft-guard require `platformAdmin` (Phase 2C)
- [ ] Live `/platform/*` Clerk-only check with platformAdmin metadata (needs keys)
