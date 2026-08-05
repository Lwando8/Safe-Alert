# Reuse vs Change Matrix

Verticalisation principle: university is a product surface, not a destructive rewrite. Prefer extending generic domain concepts over hard-coding “University” into the data model.

## Matrix

| Area | Decision | Notes |
|------|----------|-------|
| Incident + assignment + timeline shapes | **Reuse** | Add `organizationId` / `siteId`; expand categories later |
| Shift start/end, heartbeat, device gating | **Reuse** | Bind shifts to site/zones; harden approval in Phase 2 |
| Firebase Auth + callables pattern | **Reuse** | Claims must carry org/site/membership; tighten rules before multi-tenant |
| Emergency contacts CRUD | **Reuse** (as Trusted Contact base) | Add consent, share sessions, privacy controls later |
| Live location trail on incident | **Reuse** | Formalise as LocationSession; campus geofence awareness later |
| Responder role enum (`police`, `ems`, …) | **Change** (product vocabulary) | Org-scoped responder types (e.g. campus_security); external types via IntegrationProvider |
| Public SOS copy / simulated Johannesburg police | **Change** | University-branded SOS; campus security as first network |
| `onIncidentCreatedNotify` (broadcast ≤1000 tokens) | **Change** (scoping) | Keep FCM pattern; scope to org/site/role/zone |
| Mobile admin screens | **Reuse temporarily** | Primary ops move to web control room |
| Legacy `server/` + `responder-app/` | **Keep as reference** | Do not delete; do not build on |
| Glass RN design system | **Reuse for Expo** | Do not install web shadcn into Expo |
| Web dashboard | **Create** | `apps/web` Next.js + shadcn (Phase 1 foundation) |
| Shared domain types | **Create** | `packages/domain` |
| Postgres / Prisma migration | **Defer** | Stay on Firebase through university MVP unless analytics force otherwise |
| External police / ambulance / private security | **Defer** | Stable IntegrationProvider stubs only |
| NativeWind / React Native Reusables | **Defer** | Audit Expo styling separately after web foundation |

## Public-SOS assumptions → university scope

| Assumption | Required change |
|------------|-----------------|
| Responder vocabulary = police/EMS/armed response | Campus security as first managed network; external types behind integrations |
| Product copy promises police/ambulance | University-branded SOS and campus response progress |
| Open `registerCitizen` without membership | Users belong to an Organization (and Site where applicable) |
| Global incident queries | Every query scoped by `organizationId` (+ `siteId` when campus-level) |
| Broadcast FCM to all tokens | Notify authorised campus responders / control room only |
| Legacy unauthenticated public create | Must never return in university product |
| “Safe Zones” = contact location simulation | Real Site/Zone geofences and buildings |

## What Phase 1 does not change

- Incident create / accept / status state machine
- Existing Expo navigation and glass UI
- Deletion of deprecated packages
- Production branding sweep of all SOS screens
- Full tenant migration of demo data
