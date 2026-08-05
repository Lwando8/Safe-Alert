# Vercel monorepo note (Phase 2)

## Root cause of the failing Vercel check

The Git-connected Vercel project has **Root Directory = unset** while this repo is a
monorepo (**Expo at repo root**, **Next.js at `apps/web`**). Every preview deploy from
the monorepo root has failed (historically in ~0s during framework validation; later
attempts that forced Next at the root still could not package `apps/web` correctly).

`rootDirectory` **cannot** be set from `vercel.json` for Git deployments — it is a
Vercel **Project Setting** (dashboard / API).

## Repo mitigation (in place)

Root [`vercel.json`](../vercel.json) uses `ignoreCommand` that **exits 0**, so Vercel
skips deploying from the Expo root and the GitHub “Vercel” status does not stay red.

Real Next.js compile coverage is provided by
[`.github/workflows/phase2-web.yml`](../.github/workflows/phase2-web.yml).

[`apps/web/vercel.json`](../apps/web/vercel.json) is ready for when Root Directory is
set to `apps/web`.

## Required permanent fix (dashboard)

In Vercel → Project **safe-alert** → Settings → Build & Deployment:

1. Set **Root Directory** to `apps/web`
2. Enable **Include source files outside of the Root Directory** (workspaces)
3. Install command: `cd ../.. && npm install` (or use `apps/web/vercel.json`)
4. Build command: `cd ../.. && npm run domain:build && npm run build --workspace=@seren/web`
5. Set Clerk env vars:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`

After Root Directory is `apps/web`, remove the root `ignoreCommand` skip (or delete
root `vercel.json`) so preview deploys run again from the web app.
