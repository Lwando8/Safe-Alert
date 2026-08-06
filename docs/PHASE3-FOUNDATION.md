# Phase 3 — Foundation (non-breaking)

**Status:** Planning + domain foundations only. Do not replace mobile SOS flows yet.

## Goal

University student/staff verticalisation on top of Phase 2 tenant isolation.

## Prerequisites

- Phase 2B–2E tenant isolation verified (emulator + live webhook path)
- Mobile Clerk removal gate still open (`ALLOW_FIREBASE_AUTH_FALLBACK` may remain on)

## Foundations already present

- Domain: Organization / Site / Zone / Membership / TrustedContact / IncidentMode (`packages/domain`)
- Web university ops shell (`apps/web` `(university)`)
- Tenant-scoped incidents + responders read models

## Safe next increments (order)

1. Campus-branded copy layer (labels only; no auth changes)
2. Membership-kind aware home (student vs staff) behind feature flags
3. Incident category taxonomy for campus safety (extend, don't fork state machine)
4. Silent / discreet SOS field plumbing (domain already typed)
5. Trusted contacts CRUD scoped by organizationId + consent flags
6. Broadcasts consumption API (read-only) for mobile

## Explicit non-goals (this foundation doc)

- Rewriting emergency state machine
- Removing Firebase fallback
- Shipping public police/ambulance marketplace UX
