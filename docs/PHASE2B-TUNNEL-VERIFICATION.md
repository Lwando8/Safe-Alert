# Phase 2B — Public tunnel verification (ephemeral)

**Date:** 2026-08-06  
**ACCESS_PATH:** `public_tunnel` (provider omitted from permanent docs; hostname/credentials **not** recorded here)

## Result summary

| Check | Result |
|---|---|
| Next.js on VM `127.0.0.1:3000` | **PASS** (healthy; not the cause of phone `localhost` errors) |
| Ephemeral tunnel → app HTML | **PASS** (HTTP 200 with tunnel reminder bypass) |
| Clerk sign-in widget via tunnel | **BLOCKED** — Clerk frontend/CDN returns 403 for non-allowlisted tunnel origin |
| Full Ops A / platform UI via tunnel | **NOT COMPLETED** (blocked on Clerk origin policy) |

## Interpretation

Phone `localhost:3000` → `ERR_CONNECTION_*` is an **access-path** problem (device loopback ≠ Cloud Agent VM), **not** a Next.js server failure.

A public tunnel can reach the Next process, but **Clerk Development** still rejects the tunnel origin for hosted components unless a proper satellite/proxy domain setup is configured. That is separate from app health.

## Authoritative UI auth evidence

Use the completed **VM loopback** walkthrough:

- [`PHASE2B-UI-WALKTHROUGH-2026-08-06.txt`](./PHASE2B-UI-WALKTHROUGH-2026-08-06.txt)
- Access path: `vm_loopback`
- Ops tenant pages, University B spoof denial, `/platform` RBAC: **PASS**

## Operator guidance for external devices

1. **Preferred:** Cursor Desktop → Ports → forward `3000` → open IDE preview URL (`cursor_port_forward`)
2. **Optional temp:** public tunnel for smoke connectivity only; do not use production credentials
3. After any walkthrough: rotate shared test passwords
4. Never commit tunnel hostnames, IPs/passwords, tickets, or secrets

## Security cautions honored

- No tunnel hostname/password in this file
- No sign-in tickets or Clerk secrets
- Tunnel treated as temporary development access only
