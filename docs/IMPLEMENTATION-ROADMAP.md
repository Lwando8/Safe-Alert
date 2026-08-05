# Implementation Roadmap (Phase 2+)

Phase 1 stops at inventory, domain types, and web/shadcn foundation.  
This document outlines subsequent work only — do not treat it as an immediate build checklist.

## Phase 1 — Foundation (this phase)

- Repository inventory and reuse matrix
- Generic domain model (Organization / Site / Zone / Membership / …)
- Risk report and stop-gate
- `packages/domain` TypeScript types
- `apps/web` Next.js shells: university ops + platform super-admin
- shadcn/ui + design tokens in web only

## Phase 2 — Tenant isolation and authorisation

1. Persist `organizations`, `sites`, `zones`, `memberships`, `responders` in Firestore
2. Extend Auth claims with `organizationId`, `siteIds`, approval-related flags
3. Tighten Cloud Functions: every read/write checks tenant (and site where needed)
4. Rewrite Firestore rules for tenant isolation
5. Scope `onIncidentCreatedNotify` to org/site responders
6. Responder approval workflow: install ≠ authorised
7. Seed one demo university + campus (replace soft `org-default`)

**Hard gate:** no second university tenant until this phase is verified.

## Phase 3 — Student and staff app verticalisation

1. University-branded UX (labels, emergency information, campus context)
2. Users belong to Organization (+ Site)
3. Incident categories appropriate to campus safety
4. Silent / discreet SOS where operationally appropriate
5. Trusted contacts + consent / privacy / location controls
6. Safe Walk / escort request and Ride Safety (product features)
7. Incident history, responder progress, campus broadcasts (client consumption)
8. Retire public police/ambulance product copy from primary flows

Keep emergency state machine; extend fields and UX.

## Phase 4 — Responder app hardening

1. Guard onboarding and supervisor approval
2. Shift availability + operational status bound to site/zones
3. Accept / decline / acknowledge with audit
4. En route → arrived → assisting → resolved
5. Multi-responder coordination and control-room escalation
6. Controlled access to student information
7. Evidence / incident notes
8. Full responder audit history

Prefer evolving in-app responder navigators; separate Expo responder bundle when packaging requires it. Do not revive deprecated `responder-app/` as the long-term home without a deliberate decision.

## Phase 5 — University control-room dashboard (web)

Build on `apps/web` `(university)` shell + shadcn:

1. Live incident command view
2. Campus map and zones
3. Responder availability and dispatch / reassignment
4. Escalation workflows
5. Guard and supervisor management
6. Campus / building configuration
7. Emergency broadcast management
8. Analytics: response times, categories, heatmaps, SLAs
9. Audit logs, adoption metrics, roles/permissions
10. Data-retention controls, reports, exports

## Phase 6 — Seren platform super-admin

Separate `(platform)` surface:

1. Provision / suspend organizations
2. Cross-tenant health and adoption (aggregate only)
3. Platform audit log
4. Feature flags / retention defaults
5. No day-to-day campus dispatch chrome shared with university ops

## Phase 7 — Native UI strategy

1. Audit Expo glass system vs React Native Reusables / NativeWind
2. Decide per design-system compatibility with current Expo, styling, and navigation
3. Do **not** install web-only shadcn packages into Expo

## Phase 8 — External integrations

Only behind `IntegrationProvider`:

- Police
- Ambulance / EMS
- Private security
- University systems (SSO, SIS, etc.) as separate providers

Stable interfaces first; implementations later.

## Explicit non-goals until justified

- Destructive rewrite of Firebase dispatch callables
- Postgres migration solely for “university” naming
- Deleting deprecated `server/` / `responder-app/` (keep as reference)
- Broad public emergency-response marketplace positioning
