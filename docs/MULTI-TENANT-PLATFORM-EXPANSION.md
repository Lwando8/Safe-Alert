# Multi-tenant platform expansion (Phases A–F)

Additive expansion of Seren SOS into one modular multi-tenant product:

**Safety + Operations + Community + Intelligence** — without vertical forks and without access-control features.

## Phase A — Tenant profile + modules

- `@seren/domain` (`packages/domain/src/tenantConfig.ts`): `TenantProfile`, `PlatformModule`, effective-config helpers, `Team` / request / community / broadcast types.
- Org bootstrap (`MembershipSyncService.ensureOrganizationAndDefaultSite`) stamps `tenantProfile: UNIVERSITY` + default modules/categories/terminology without clobbering overrides.
- Backfill: `firebase/functions/scripts/backfill-tenant-profiles.ts`
- Server gate: `assertModuleEnabled` (`moduleGate.ts`) — fail closed on writes.
- Platform UI: `/platform/organizations` list + `/platform/organizations/[orgId]` profile/module editor.

## Phase B — Operations requests

- Collections: `operationalRequests` (+ `timeline`), `workOrders` (create-on-assign).
- Callables: `createOperationalRequestCallable`, `listOperationalRequestsCallable`, `updateOperationalRequestStatusCallable`, `assignOperationalRequestCallable`.
- Web: `/ops/requests` + `/api/ops/requests` (session membership only; ignore `?organizationId=`).
- Mobile: **Report an Issue** (`ReportIssueScreen`) via Firebase callables.

## Phase C — Community foundation

- `communityGroups`, `communityEvents` callables + `/ops/community` visibility.
- Mobile Community tab → `CommunityHubScreen`.

## Phase D — Community Alerts + Missing Pet

- `communityAlerts` + `sightings` subcollection.
- Privacy helpers strip email/phone/home; sightings notify reporter via orgDevices outbox.
- Resolve → `resolved` (no delete).

## Phase E — Official broadcasts

- Separate `broadcasts` collection with `channel: official_broadcast`.
- Never stored as CommunityAlert.
- `/ops/broadcasts` create/list wired.

## Phase F — Analytics capture

- Append-only `analyticsEvents` from incident/request/alert/broadcast transitions.
- `/ops/analytics` aggregates counts + recent events.

## Non-goals

Access control / visitors / gates / biometrics / CCTV / payments / ERP / chat / AI dispatch.

## Isolation rules

- Stamp `organizationId` from `RequestContext` only.
- Module disabled → `failed-precondition`.
- Firestore client rules remain deny for sensitive collections.
