# Phase 2B — Live Clerk evidence (seren-sos)

**Date:** 2026-08-06  
**Firebase project:** `seren-sos`  
**Classification update:** Clerk webhook + membership sync verified live; UI walkthrough PASS on VM loopback; access-path guidance documented for Cursor forward / ephemeral tunnel.

## Preflight

```bash
cd firebase/functions && npm run preflight:clerk
# status: ready
```

## Clerk tenants

| Entity | ID / value |
|---|---|
| University A | `org_3HXC9DDgNdKU0id11CIKTqoHWlX` / slug `university-a` |
| University B | `org_3HXC9GrHZuZWC2OkLgLKXLZyRdu` / slug `university-b` |
| Ops A user | `user_3HXCGax8q7UckAvGYxsXZR2UsoF` (`ops.a@example.com`) |
| Ops B user | `user_3HXCGbT8bAD7s2X7NZj8vqsv82k` (`ops.b@example.com`) |
| Platform admin | `user_3HXCGeAX9XwBm99XvMfMIDVaie7` (`platform.admin@example.com`, `public_metadata.platformAdmin=true`) |
| Custom roles | `org:supervisor`, `org:responder`, `org:staff`, `org:student` (+ built-in `org:admin`) |

Org `public_metadata.serenOrganizationId` set to slug for both universities.

## Webhook

| Item | Result |
|---|---|
| Endpoint | `https://us-central1-seren-sos.cloudfunctions.net/clerkWebhook` (Svix endpoint `c1Vc2T`) |
| Events | `organization.created/updated`, `organizationMembership.created/updated/deleted` |
| Signing secret | Rotated + redeployed on functions (gitignored `.env` / `.env.seren-sos`) |
| Svix test `organization.updated` | **PASS** HTTP 200 |
| Live `organizationMembership.updated` | **PASS** (`webhookReceipts` status `ok`) |
| Live `organizationMembership.deleted` | **PASS** Firestore membership → `revoked` |
| Live `organizationMembership.created` | **PASS** new active membership doc |

### Integrity fix applied

`MembershipSyncService.syncMembership` no longer calls non-existent `clerk.organizationMemberships.getOrganizationMembership` (Clerk Backend SDK v4). It now syncs from webhook/list payloads (snake_case + camelCase normalized). Covered by existing unit suite (44 passing).

## Firestore (`seren-sos`)

| Collection | Evidence |
|---|---|
| `organizations/university-a` | Present with `clerkOrganizationId` |
| `organizations/university-b` | Present with `clerkOrganizationId` |
| `sites` | Default main campus site per org |
| `memberships` | Active Ops A → A (`org:admin` / `org_admin`); Ops B → B; revoked history retained fail-closed |

Bootstrap path also exercised via `MembershipSyncService.syncOrganizationMembers` (org + site ensure + member sync).

## Checklist results

| Step | Result | Evidence |
|---|---|---|
| `preflight:clerk` | **PASS** | `ready` |
| University A/B orgs + memberships | **PASS** | Clerk API + Firestore |
| `platformAdmin` metadata | **PASS** | User public metadata |
| Webhook sync create/update/delete | **PASS** | `webhookReceipts` + membership status |
| Sign-in + org select (`/ops`) | **PASS** | Ticket sign-in + University A (2026-08-06 UI) |
| `/ops/incidents` tenant list | **PASS** | Empty list for `university-a` (ADC + live Firestore) |
| `/ops/responders` / `/ops/campus` | **PASS** | Membership + Main Campus site |
| Org ID spoof ignored | **PASS** | API returned `organizationId:"university-a"` for `?organizationId=university-b` |
| Membership revoke → ops denied | **PASS (data path)** | Webhook set `revoked` |
| `/platform` admin-only | **PASS** | Ops A → `/unauthorized`; platformAdmin → console |
| `/ops` requires org | **PASS** | Live org scoping |
| Clerk JWT on callable | **PENDING** | Separate callable probe |

UI transcript (VM loopback): [`PHASE2B-UI-WALKTHROUGH-2026-08-06.txt`](./PHASE2B-UI-WALKTHROUGH-2026-08-06.txt)  
Access-path correction: [`PHASE2B-ACCESS-PATH.md`](./PHASE2B-ACCESS-PATH.md)  
Public tunnel note: [`PHASE2B-TUNNEL-VERIFICATION.md`](./PHASE2B-TUNNEL-VERIFICATION.md)

## Test accounts (non-production)

Passwords were set via Clerk Backend API for agent verification. Rotate/disable after operator handoff. Domains use `@example.com` (Clerk rejects `.local`). **Do not put passwords or tickets in git.**
