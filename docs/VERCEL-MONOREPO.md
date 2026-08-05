# Vercel monorepo note (Phase 2)

The Git-connected Vercel project currently has **Root Directory = unset** while this
repo is a monorepo (Expo at repo root, Next.js at `apps/web`). That caused preview
deploys to **fail instantly** (framework validation never finds `next` at the Expo
root), even when `apps/web` builds locally.

## Repo workaround (in place)

1. Root [`package.json`](../package.json) lists `next` so Vercel’s Next.js preset can
   validate the project at the monorepo root.
2. Root [`vercel.json`](../vercel.json) builds `@seren/domain` + `@seren/web` with
   `SEREN_VERCEL_ROOT_STAGING=1`, which writes `.next` to the repo root via
   [`apps/web/next.config.ts`](../apps/web/next.config.ts) `distDir`, and copies
   `apps/web/public` to root `public`.
3. Root [`next.config.ts`](../next.config.ts) re-exports the web app config.

## Preferred permanent fix (dashboard)

In Vercel → Project → Settings → Build & Deployment:

1. Set **Root Directory** to `apps/web`
2. Enable **Include source files outside of the Root Directory** (for workspaces)
3. Install command: `cd ../.. && npm install` (or leave default if auto-detected)
4. Build command: `cd ../.. && npm run domain:build && npm run build --workspace=@seren/web`  
   (or rely on [`apps/web/vercel.json`](../apps/web/vercel.json))
5. Set Clerk env vars:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`

After Root Directory is set to `apps/web`, remove the root `next` dependency, root
`next.config.ts`, root staging `buildCommand`, and `SEREN_VERCEL_ROOT_STAGING` /
`distDir` override.
