# Phase 2B — Access path & UI verification note

**Date:** 2026-08-06  
**Branch tip:** `7b302be` (+ follow-up evidence commit if present)  
**App server:** Next.js `@seren/web` listening on VM `127.0.0.1:3000` (**healthy**)

## Correction: localhost failure is an access-path issue

`ERR_CONNECTION_REFUSED` / `ERR_CONNECTION_FAILED` when opening `localhost:3000` from a phone or external browser is **not** a Next.js crash.

The Cloud Agent runs the server **inside the remote VM**. On a phone or other device, `localhost` resolves to **that device**, so the connection never reaches the VM.

Valid access paths:

| Path | Audience | Notes |
|---|---|---|
| VM loopback `127.0.0.1:3000` | Agent / in-VM tools | Always works when `web-dashboard` is up |
| Cursor Desktop **Ports** forward | Operator on Desktop | Use the IDE-generated preview URL |
| Ephemeral public tunnel (e.g. loca.lt) | Phone / external browser | **Temporary dev only** |

## Security cautions (do not violate)

- Treat any public tunnel as **temporary development access only**
- Do **not** enter production credentials through a tunnel
- Rotate shared test passwords after walkthroughs
- Do **not** commit: tunnel hostname, tunnel password/IP, sign-in tickets, Clerk secrets, or test credentials
- Tunnel hostname/IP can change on restart — never put them in permanent docs

## Verification checklist (operator or agent)

Record **URL type only** (`cursor_port_forward` | `public_tunnel` | `vm_loopback`) — not the hostname.

1. Open forwarded or tunnel URL (not raw phone-localhost)
2. Sign in as University A operations user
3. Verify `/ops`, `/ops/incidents`, `/ops/responders`, `/ops/campus`
4. Confirm University B data is absent (including `?organizationId=university-b` spoof)
5. Sign out; confirm protected data is gone
6. Platform account → `/platform/*` allowed
7. Operations account → `/platform/*` denied

## Prior clean walkthrough (VM loopback)

Recorded in [`PHASE2B-UI-WALKTHROUGH-2026-08-06.txt`](./PHASE2B-UI-WALKTHROUGH-2026-08-06.txt):

- Access path: **`vm_loopback`** (`127.0.0.1` via Cloud Agent browser automation)
- Ops A tenant pages + spoof denial + `/platform` RBAC: **PASS**
- Platform admin `/platform`: **PASS**

## Follow-up tunnel verification

See [`PHASE2B-TUNNEL-VERIFICATION.md`](./PHASE2B-TUNNEL-VERIFICATION.md) for the public-tunnel pass status (hostname omitted).
