# Phase 4 — Foundation (non-breaking)

**Status:** Planning + ops read models. Do not revive deprecated `responder-app/` as the long-term home without a deliberate decision.

## Goal

Responder hardening on tenant-scoped memberships, units, shifts, and audit.

## Prerequisites

- Dual-auth callables for accept/assign/update + shift/heartbeat bridge
- Ops `/ops/responders` tenant list available for control-room visibility

## Foundations already present

- `responderUnits` + membership `responderProfile`
- Shift/heartbeat callables prefer RequestContext; Firebase RESPONDER_UNIT claims retained while fallback is on
- Permission map: `org:responder` / `org:supervisor` / `org:admin`

## Safe next increments (order)

1. Supervisor approval workflow fields on `responderProfile` (pending → approved)
2. Shift start/end already stamps `organizationId` — add ops UI list of active shifts
3. Accept / decline audit timeline (already partially written on accept)
4. En-route → arrived → assisting status vocabulary alignment
5. Controlled student PII views gated by permission + site

## Explicit non-goals (this foundation doc)

- Deleting Firebase claim login before device gate
- Forking a second production responder Expo app without packaging need
- Client-side org id trust for dispatch
