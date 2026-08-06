# Phase 2 — Operator next steps (post 2B/2C/2D)

**Branch:** `cursor/phase-2b-tenant-backend-8d10`  
**Stop-gate:** `tenant-safe but partially verified`

Local IDE preview / port-forward is **non-blocking**. Focus here.

## Current status (2026-08-06)

| Item | Status |
|---|---|
| Phase 2B–2D code + unit/emulator probes | Done |
| Web Clerk `pk_test` / `sk_test` in `apps/web/.env.local` | Present |
| Functions Clerk secret + publishable (local `.env`, gitignored) | Synced for agent |
| `npm run preflight:clerk` | **`ready`** |
| Live Clerk University A/B + webhook sync | **Verified** — see `PHASE2B-LIVE-CLERK-EVIDENCE.md` |
| Firebase project | **`seren-sos`** |
| Phase 2E client security rules (Firestore/RTDB deny) | **Live** |
| Firebase Functions / Cloud Run deploy | **Deployed** (us-central1) |
| Geo-radius on `getNearbyIncidents` | **Code landed** (filter when center provided) |
| Shift/heartbeat dual-auth bridge | **Code landed** (claims path retained while fallback on) |
| Ops shells | Incidents + **responders** + **campus** tenant-wired |
| Mobile Clerk prep | **Flagged off by default** — `PHASE2G-MOBILE-CLERK-PREP.md` |
| Phase 3/4 foundations | Docs only — `PHASE3-FOUNDATION.md` / `PHASE4-FOUNDATION.md` |
| Vercel Root Directory=`apps/web` | **Dashboard still required**; root ignoreCommand kept |
| Mobile Clerk cutover / remove Firebase fallback | Deferred (removal gate) |
| `/platform/organizations` provisioning (D) | Deferred |

## Operator remaining

1. Vercel dashboard: Root Directory = `apps/web`, Clerk env vars, then remove root `ignoreCommand`
2. Browser walkthrough: sign in as `ops.a@example.com` / University A → `/ops/incidents`, `/ops/responders`, `/ops/campus`
3. Platform user: `platform.admin@example.com` with `platformAdmin` metadata → `/platform`
4. Rotate test passwords after handoff
5. Keep `ALLOW_FIREBASE_AUTH_FALLBACK` on until mobile device gate

## 1. Deploy Firebase Functions (Cloud Functions gen2 → Cloud Run)

This environment cannot authenticate to Google Cloud. On a machine with access:

```bash
# one-time
firebase login
# or CI: export FIREBASE_TOKEN=$(firebase login:ci)

# from repo
cd firebase
firebase use seren-sos   # already default in .firebaserc
cd functions
npm ci
npm test
npm run build

# set runtime config / secrets (prefer Secret Manager for prod)
firebase functions:secrets:set CLERK_SECRET_KEY --project seren-sos
# after webhook exists:
firebase functions:secrets:set CLERK_WEBHOOK_SECRET --project seren-sos

npm run deploy   # firebase deploy --only functions --project seren-sos
```

Note the HTTPS URL printed for **`clerkWebhook`**.

### Wire Clerk webhook

1. Clerk Dashboard → **Webhooks** → Add endpoint = `clerkWebhook` URL  
2. Subscribe: `organizationMembership.created|updated|deleted`, `organization.created|updated`  
3. Copy **Signing secret** (`whsec_...`) → `CLERK_WEBHOOK_SECRET`  
4. Redeploy or update the secret  
5. `cd firebase/functions && npm run preflight:clerk` → expect **`ready`**

## 2. Live Clerk operator checklist

When preflight = `ready`, run  
[`PHASE2B-MANUAL-VERIFICATION-CHECKLIST.md`](./PHASE2B-MANUAL-VERIFICATION-CHECKLIST.md) § Clerk path:

- University A/B orgs + memberships  
- `platformAdmin` metadata for a platform user  
- `/ops/incidents` tenant list  
- Org spoof API denied  
- Membership revoke  
- Record evidence in `PHASE2B-TEST-EVIDENCE.md`

## 3. Vercel (web dashboard hosting)

Dashboard (cannot be done from repo alone):

1. Project **safe-alert** → Root Directory = **`apps/web`**  
2. Include files outside root  
3. Use [`apps/web/vercel.json`](../apps/web/vercel.json) install/build  
4. Env: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`  
5. Remove root `ignoreCommand` skip in [`vercel.json`](../vercel.json)

## 4. Explicitly deferred

- Mobile Clerk cutover / `ALLOW_FIREBASE_AUTH_FALLBACK=false` (device gate)
- `/platform/organizations` provisioning UI (track D)
- Client Firestore/RTDB org-claim re-open (after Clerk claims verified)
- `loginResponder` / `loginAdmin` / `registerCitizen` claim factories (still Firebase-oriented)

## 5. Completed in this pass

1. ~~Phase 2E security rules~~
2. ~~Live Clerk webhook + University A/B membership sync~~
3. ~~Geo-radius filter on `getNearbyIncidents`~~
4. ~~Shift/heartbeat dual-auth bridge (claims retained)~~
5. ~~Ops responders + campus tenant wiring~~
6. ~~Mobile Clerk prep boundary (flagged off)~~
7. ~~Phase 3/4 foundation docs~~

## Deployed endpoints

- **clerkWebhook:** https://us-central1-seren-sos.cloudfunctions.net/clerkWebhook (Svix `c1Vc2T`)
- Callables live in **us-central1** (`createIncident`, `listOrgIncidents`, `getNearbyIncidents`, `startShift`, …)

## Operator remaining

1. Vercel dashboard: Root Directory = `apps/web`, Clerk env vars, then remove root `ignoreCommand`
2. Browser walkthrough: sign in as `ops.a@example.com` / University A → `/ops/incidents`, `/ops/responders`, `/ops/campus`
3. Platform user: `platform.admin@example.com` with `platformAdmin` metadata → `/platform`
4. Rotate test passwords after handoff
5. Keep `ALLOW_FIREBASE_AUTH_FALLBACK` on until mobile device gate

### CLI reminder (this repo)

```bash
./node_modules/.bin/firebase --version
# or
npx firebase --version
npm run firebase:login          # --no-localhost flow
npm run firebase:deploy:functions
```
