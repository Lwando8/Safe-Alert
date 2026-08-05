# AGENTS.md

## Cursor Cloud specific instructions

This is a multi-part monorepo for **Seren SOS / Safe Alert** (campus-safety emergency response). The
active branch focus is the **Phase 2B tenant backend** (`firebase/functions`) plus the **web dashboards**
(`apps/web`). Dependencies are refreshed automatically on VM startup by the update script
(`npm install` at the root + `npm --prefix firebase/functions install`). The notes below cover only the
non-obvious things; standard commands live in the referenced `package.json` files and READMEs.

### Services and how to run them

- **Web dashboards (`apps/web`, Next.js 16 + Turbopack)** — run `npm run web:dashboard` from the repo root
  (alias for `next dev` in the `@seren/web` workspace). Serves on `http://localhost:3000` with `/` (picker),
  `/ops/*` (university control room), and `/platform/*` (super-admin) surfaces. See `apps/web/README.md`.
- **Firebase emulators / tenant backend (`firebase/functions`)** — run `npm run firebase:emulators` from the
  root, or `npm run serve` inside `firebase/functions` (builds via `tsc`, then starts
  functions/firestore/database/auth). Emulator UI on `:4001`, functions `:5001`, firestore `:8080`,
  database `:9000`, auth `:9099`. See `firebase/functions/package.json` scripts.
- **Phase 2B verification** — `npm run smoke:phase2b:checklist` (prints the verification matrix) and
  `npm run smoke:phase2b` (offline policy assertions; the network/live-Clerk cases report `MANUAL`) inside
  `firebase/functions`. This is the fastest way to sanity-check tenant-isolation policy without emulators.
- **Shared types (`packages/domain`)** — `npm run domain:build` from the root. `packages/domain/dist` is
  **gitignored**, so build it before typechecking `apps/web` or any consumer of `@seren/domain`
  (`next dev` itself currently runs without it because nothing imports `@seren/domain` at runtime yet).
- **Mobile apps (`src/` root Expo app, `responder-app/`) and legacy `server/`** — optional and not part of
  the automatic setup. The Expo apps need a simulator/device (`npm start`); `responder-app` and `server`
  have their **own** `npm install` (they are not npm workspaces). `server/` is deprecated per the root README.

### Non-obvious caveats

- **`firebase/functions` compiles to `lib/src/index.js`, but `package.json` `main` is `lib/index.js`.**
  `tsconfig.json` uses `rootDir: "."` with `include: ["src/**", "scripts/**"]`, so `tsc` emits
  `lib/src/index.js` (the current code, with `clerkWebhook`, `bootstrapOrganizationMemberships`,
  `linkIdentity`, etc.). The committed `lib/index.js` is an **older/stale build** and is what the emulator
  actually loads (it will be missing the newer Phase 2B functions and `health` will return only
  `{ ok: true }`). If you change functions and need the emulator to run the current code, be aware of this
  entrypoint mismatch.
- **Firebase Functions declare `engines.node: 20`, but the VM runs Node 22.** The emulator prints a version
  warning and then uses the host Node 22; functions still load and run.
- **`apps/web` runs without Clerk keys.** `middleware.ts` and `layout.tsx` fall back to a pass-through /
  no-auth mode when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` are unset (or contain
  `your_key`), so the Phase 1 shells are viewable without credentials. To exercise real auth, tenant orgs,
  and the Clerk→Firestore membership webhook, provide real Clerk keys (see `apps/web/.env.local.example`,
  `firebase/functions/.env.example`, and `docs/PHASE2-CLERK-SETUP-GUIDE.md`).
- **`firebase/functions` is not an npm workspace**, so root `npm install` does not cover it — the update
  script installs it separately.
- **`apps/web` lint currently reports pre-existing errors** (`src/hooks/use-mobile.ts` — a generated shadcn
  hook) via `npm run lint`. The tooling works; these are not environment issues.
