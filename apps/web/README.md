# `@seren/web`

Next.js App Router dashboards for **Seren SOS for Universities**.

## Surfaces

| Route group | URL prefix | Purpose |
|-------------|------------|---------|
| `(university)` | `/ops/*` | University operations / control-room shell |
| `(platform)` | `/platform/*` | Seren super-admin (separate chrome) |
| — | `/gallery` | shadcn component gallery |
| — | `/` | Destination picker |

Phase 1 ships **shells and design-system foundation only**. Live dispatch, maps, and analytics are later phases.

## Design tokens

Defined in [`src/app/globals.css`](src/app/globals.css):

| Token | Role |
|-------|------|
| `--primary` | Deep forest teal (actions, brand accent) |
| `--background` | Cool stone canvas (not warm cream) |
| `--sos` / `--success` / `--warning` | Operational semantics |
| `--sidebar-*` | University ops navigation |
| `--font-sans` | DM Sans |
| `--font-display` | Fraunces (`font-display` utility) |

Avoid purple-on-white gradients and cream + terracotta defaults. Platform shell uses a darker sidebar variant so it never shares university ops chrome.

## shadcn/ui

- Config: [`components.json`](components.json)
- Components: [`src/components/ui/`](src/components/ui/)
- **Do not** install these web packages into the Expo mobile apps

Installed primitives include: button, input, label, textarea, field, table, dialog, sheet, tabs, badge, dropdown-menu, command, alert-dialog, sonner, sidebar, card, separator, select, checkbox, switch, scroll-area, skeleton, avatar, tooltip.

## Scripts

From repo root:

```bash
npm run web:dashboard
```

From this package:

```bash
npm run dev
npm run build
```

## Domain types

```ts
import type { Organization, Site } from "@seren/domain";
```

Internal names stay generic; UI may say University / Campus.
