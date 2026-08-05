# Phase 2 — Operator next steps (post 2B/2C/2D)

**Branch:** `cursor/phase-2b-tenant-backend-8d10`  
**Stop-gate:** `tenant-safe but partially verified`

Local IDE preview / port-forward is **non-blocking**. Focus here.

## Current status (2026-08-05)

| Item | Status |
|---|---|
| Phase 2B–2D code + unit/emulator probes | Done |
| Web Clerk `pk_test` / `sk_test` in `apps/web/.env.local` | Present |
| Functions Clerk secret + publishable (local `.env`, gitignored) | Synced for agent |
| `npm run preflight:clerk` | **`keys_ready`** (webhook secret still missing — expected pre-deploy) |
| Firebase project | **`seren-sos`** (`.firebaserc` set) |
| Firebase Functions / Cloud Run deploy | **Blocked** — no `firebase login` / `FIREBASE_TOKEN` in this VM |
| Vercel preview from Expo monorepo root | Skipped via `ignoreCommand`; set Root Directory=`apps/web` in dashboard |
| Mobile Clerk cutover / remove Firebase fallback | Deferred (removal gate) |

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

- Mobile Clerk cutover / `ALLOW_FIREBASE_AUTH_FALLBACK=false`  
- Second **production** university onboarding  
- `/platform/organizations` provisioning UI  
- Client Firestore/RTDB org-scoped rules rewrite  

## Agent cannot proceed until you provide

1. ~~Firebase project id~~ → **`seren-sos`** recorded in `firebase/.firebaserc`  
2. **Auth** — `firebase login` on your machine, or set **`FIREBASE_TOKEN`** (from `firebase login:ci`) in the agent/CI env  
3. After deploy: **`CLERK_WEBHOOK_SECRET`**
