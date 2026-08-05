# Vercel monorepo note (Phase 2)

The Git-connected Vercel project currently has **Root Directory = unset** while this
repo is a monorepo (Expo at repo root, Next.js at `apps/web`). That caused preview
deploys to fail even when `apps/web` builds locally.

## Repo workaround (in place)

Root [`vercel.json`](../vercel.json) forces:

- `framework: nextjs`
- build `@seren/domain` + `@seren/web`
- copy `apps/web/.next` (and `public`) to the repo root so the Next builder can find output

Root [`next.config.ts`](../next.config.ts) re-exports `apps/web/next.config`.

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

After Root Directory is set to `apps/web`, the root `.next` copy workaround can be removed.
