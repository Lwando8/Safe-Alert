# User onboarding paths (Clerk)

**Date:** 2026-08-07  
**Intent:** Universities are **provisioned tenants**, not self-serve signups.

## Personas

| Persona | How they get access | After sign-in |
|---|---|---|
| **University ops / staff / student** | Account via `/sign-up` or admin-created user **+** Clerk org **membership invite/add** to an existing university | `/select-organization` → pick university → `/ops/*` |
| **Platform admin** | Account with `public_metadata.platformAdmin=true` | `/platform/*` (**no org required** by app guards) |
| **Seren provisioning** (future D) | Platform console creates org + default site + bootstrap memberships | Not self-serve from `/sign-up` |

## What you saw on the tunnel link

Opening the public base URL and signing in previously hit Clerk **`force_organization_selection=true`**, which forced **every** user (including platform admins) to select or **create** an organization. That felt like “register my organization.”

That is **not** the intended product path for campus users.

### Corrections applied (2026-08-07)

1. Clerk instance: `force_organization_selection=false`
2. Clerk instance: `organization_creation_defaults.enabled=false`
3. Test users: `create_organization_enabled=false` (ops + platform)
4. Web UI: select-organization copy explains invite-only; create CTA removed from product wiring; platform admins get a skip link to `/platform`

## Normal (non-platform) user flow

```
Sign up (/sign-up)
  → account exists, usually zero memberships
  → visit /ops
  → redirected to /select-organization
  → if invited: choose University A/B → /ops
  → if not invited: empty list + message to contact campus admin
```

Campus admins add members in Clerk (Dashboard or future `/platform` tooling). Webhook/bootstrap writes Firestore `memberships` so ops APIs authorize.

## Platform admin flow

```
Sign in
  → open /platform (allowed with platformAdmin metadata; org optional)
  → do NOT create a university from the membership picker
```

If Clerk still shows an org UI, use **Go to platform console** on `/select-organization`.

## Security notes

- Self-serve org creation would create Clerk orgs **without** Seren provisioning (sites, rules, bootstrap) — disabled for now.
- `/ops` still requires `orgId` + active Firestore membership.
- Never commit sign-in tickets, tunnel hosts, or test passwords.
