# Seren Alert — Dispatch architecture (v2)

## Three application roles

| Role | Access | Sign-up |
|------|--------|---------|
| **Citizen** | SOS, contacts, community | Public registration |
| **Responder unit** | Assignments, shift, status updates | Admin-provisioned only |
| **Admin / Dispatch** | Dashboard, units, analytics, timeline | Internal accounts only |

## Server layout

```
server/
  index.js              # HTTP + WebSocket entry
  data/store.json       # Persisted state (auto-created)
  lib/
    store.js            # Entities + persistence
    crypto.js           # Password hashing
    permissions.js      # Role middleware
    timeline.js         # Append-only incident events
    analytics.js        # Response time metrics
    dispatch.js         # Assignment + broadcast
    seed.js             # Demo data
  routes/
    auth.js             # /auth/citizen|responder|admin/*
    incidents.js        # /incidents/* (also mounted at /alerts)
    responder.js        # /responder/* (protected)
    admin.js            # /admin/* (protected)
```

## Data entities

- **ResponderUnit** — vehicle/unit identity (`unitCode`, `loginId`, `responderType`, device binding)
- **ShiftSession** — officer clock-in to a unit
- **IncidentTimelineEvent** — immutable append-only audit log
- **Incidents** — same as legacy alerts (backward compatible JSON shape)

## Client layout

```
src/
  screens/
    AuthEntryScreen.tsx       # Choose citizen / unit / admin
    LoginScreen.tsx           # Citizen only
    ResponderLoginScreen.tsx  # Unit credentials
    AdminLoginScreen.tsx
    responder/                # Shift gate + assignments
    admin/                    # Control center
  services/
    AuthService.ts
    ResponderService.ts
    AdminService.ts
    ApiClient.ts
    DispatchApi.ts            # Citizen SOS (unchanged paths)
  navigation/
    RootNavigator.tsx         # Routes by role
```

## Demo credentials

Use the **correct sign-in path** on the auth entry screen:

| Role | Screen | Login | Password |
|------|--------|-------|----------|
| Citizen | Citizen | demo@safealert.com | demo123 |
| Responder unit | Responder unit | ALPHA-12 | unit123 |
| Dispatch | Dispatch / Admin | dispatch@safealert.com | admin123 |
| Super admin | Dispatch / Admin | super@safealert.com | super123 |

Old emails like `unit42@safealert.com` are **not** used anymore — use **unit IDs** (ALPHA-12) on the responder screen.

Demo passwords are **refreshed every server start**. To reset manually: `curl -X POST http://localhost:4000/auth/reseed-demo`

## Migration notes

1. **Restart server** after pull — seeds units on first run; state in `server/data/store.json`.
2. **Legacy `/auth/login`** with `intendedRole: client` still works; responder mode on citizen login is **rejected**.
3. **Legacy `POST /alerts`** without auth still creates incidents (dev compat).
4. **Responder self-setup** removed — units come from admin invite API.
5. Delete `server/data/store.json` to reset demo data.

## Security

- Bearer token required for `/responder/*` and `/admin/*`.
- Citizens cannot list operational incidents or responder locations.
- Timeline events are never updated/deleted in application code.

## Future scalability

- Replace JSON store with PostgreSQL + migrations (Prisma/Drizzle).
- Move passwords to bcrypt/argon2; enforce PIN per officer in DB.
- Device approval workflow (queue pending devices for dispatcher).
- Push notifications for assignment; map replay from timeline + location stream.
- Separate deployable bundles: citizen app, responder app, admin tablet app (shared API).
