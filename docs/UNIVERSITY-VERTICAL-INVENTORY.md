# Seren SOS for Universities — Repository Inventory

Phase 1 inventory for verticalising Safe-Alert into **Seren SOS for Universities**.  
Product framing: university safety and campus-response platform. University security personnel are the first managed responder network. External police, ambulance, and private security remain future integrations.

## Repository shape

Not a formal monorepo today. Nested npm packages:

| Path | Package name | Purpose | Status |
|------|--------------|---------|--------|
| `/` (root) | `safe-alert-sos-app` | Expo citizen + in-app responder + in-app admin | **Active** |
| `responder-app/` | `safe-alert-responder` | Standalone Expo responder | Deprecated |
| `server/` | `safe-alert-dispatch-server` | Express + JSON store + Leaflet HTML | Deprecated (reference) |
| `firebase/functions/` | `safe-alert-firebase-functions` | Cloud Functions dispatch backend | **Active** |

Phase 1 adds:

| Path | Purpose |
|------|---------|
| `packages/domain` | Shared TypeScript domain types (generic internals) |
| `apps/web` | Next.js university ops + Seren platform super-admin shells |

## Tech stack (active)

- **Mobile:** Expo 54, React Native 0.81, React Navigation 6, StyleSheet glass UI (`src/theme/colors.ts`)
- **Auth:** Firebase Auth with custom claims (`role`, `unitId`, `organizationId`)
- **Data:** Firestore (documents), Realtime Database (live tracks), FCM (push)
- **Backend:** Cloud Functions v2 callables in `firebase/functions/src/index.ts`
- **Web dashboard:** none prior to Phase 1 (legacy `server/public/responder.html` only)

No Clerk, Prisma, Drizzle, Tailwind, or shadcn in the Expo app. Do not install web-only shadcn into Expo.

## Application surfaces today

Role routing in `src/navigation/RootNavigator.tsx`:

| App role | Navigation | Screens |
|----------|------------|---------|
| `CITIZEN` → `client` | `MainNavigator` | SOS, contacts, community, profile |
| `RESPONDER_UNIT` → `responder` | `ResponderNavigator` | Shift, assignments, map, alert detail |
| `DISPATCHER` / `SUPER_ADMIN` → `admin` | `AdminNavigator` | Mobile admin / control-center screens |

## Auth and roles

Defined in `src/types/auth.ts`:

- `CITIZEN`
- `RESPONDER_UNIT`
- `DISPATCHER`
- `SUPER_ADMIN`

Callables: `registerCitizen`, `loginResponder`, `loginAdmin`, `resolveDeviceAccess` (device gating via `operationalDevices`).

## Firestore collections (active)

| Collection | Notes |
|------------|-------|
| `users/{uid}` | Profile; subcollections `emergencyContacts`, `medical` |
| `incidents/{id}` | Incidents; subcollection `timeline` |
| `responderUnits/{id}` | Unit identity; soft `organizationId` |
| `shifts/{id}` | Shift sessions |
| `operationalDevices/{deviceId}` | Device approval gate |
| `admins/{email}` | Admin allow-list (seed / login) |
| `fcmTokens/{uid}/devices/{deviceId}` | Push tokens |

RTDB: `incidentTracks/{incidentId}/points`, live unit tracks.

## Cloud Functions (exported)

`registerCitizen`, `resolveDeviceAccess`, `loginResponder`, `loginAdmin`, `createIncident`, `appendIncidentLocation`, `getNearbyIncidents`, `startShift`, `endShift`, `acceptIncident`, `updateIncidentStatus`, `assignUnitToIncident`, `unitHeartbeat`, `registerPushToken`, `health`, `legacyApiProxy`, `onIncidentCreatedNotify`.

## Incident lifecycle (preserve)

1. Citizen creates incident (`status: open`, `mapStatus: unassigned`, empty `assignments`)
2. Marketplace accept or dispatcher assign
3. Assignment: `pending` → `accepted` → `en_route` → `on_scene` → `resolved` | `declined`
4. Append-only timeline events
5. Location stream via `appendIncidentLocation` / RTDB points

Do not rewrite this flow in Phase 1.

## Multi-tenancy today

- Soft `organizationId` on responder units and some claims
- **No** university / campus / zone / membership models
- **No** tenant filters on `getNearbyIncidents` or Firestore rules
- Rules are role + ownership only (`firebase/firestore.rules`)

## UI systems

| Surface | UI |
|---------|----|
| Expo root | Custom glass components (`GlassCard`, `BlurOverlay`, `Screen`) + theme colors |
| Legacy HTML | Plain CSS + Leaflet |
| `apps/web` (Phase 1) | Next.js + Tailwind + shadcn/ui |

## Product vocabulary gaps

Hard-coded public emergency assumptions:

- `ResponderRole`: police, metro_police, armed_response, medical, community_patrol, ems
- SOS copy promising police / ambulance
- Simulated Johannesburg units in `EmergencyService`
- Broadcast FCM on incident create (not org/site scoped)
- Public citizen registration without org membership

## Related docs

- `docs/DISPATCH-ARCHITECTURE.md` — legacy three-role dispatch layout
- `docs/REUSE-VS-CHANGE.md` — reuse matrix
- `docs/DOMAIN-MODEL.md` — target generic domain
- `docs/RISKS-PHASE1.md` — risks
- `docs/IMPLEMENTATION-ROADMAP.md` — Phase 2+
