# Domain Model — Generic Internals

UI may say University, Campus, Student, Security Guard.  
Internal names stay generic so the platform can expand beyond higher education.

## Hierarchy

```
Seren Platform
└── Organization (tenant / university)
    ├── Site (campus)
    │   ├── Zone (building / geofence / response zone)
    │   ├── Memberships (students, staff, contractors on this site — optional site binding)
    │   ├── Responders (security teams)
    │   └── Incidents
    └── Organization-wide administrators
```

## Core entities

### Organization (tenant)

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Document ID |
| `name` | string | Display name (e.g. university name) |
| `slug` | string | Stable URL/key |
| `status` | `active` \| `suspended` \| `provisioning` | |
| `settings` | object | Retention, branding, feature flags |
| `createdAt` | number | Epoch ms |
| `updatedAt` | number | Epoch ms |

**University label:** University

### Site

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | |
| `organizationId` | string | **Required tenant scope** |
| `name` | string | Campus name |
| `slug` | string | Unique within org |
| `timezone` | string | IANA |
| `bounds` | GeoJSON / bbox optional | Campus envelope |
| `status` | `active` \| `inactive` | |
| `createdAt` / `updatedAt` | number | |

**University label:** Campus

### Zone

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | |
| `organizationId` | string | Required |
| `siteId` | string | Required |
| `name` | string | Building, quad, parking, etc. |
| `kind` | `building` \| `geofence` \| `response_zone` \| `other` | |
| `geometry` | object | Polygon / circle |
| `createdAt` / `updatedAt` | number | |

**University label:** Building / safety zone

### User

Existing Firebase Auth user + `users/{uid}` profile.  
Profile gains optional default `organizationId` / `siteId` for UX; **authorisation comes from Membership**, not profile alone.

### Membership

Binds a user to an organization (and optionally a site).

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | |
| `organizationId` | string | Required |
| `siteId` | string \| null | Optional campus binding |
| `userId` | string | Firebase uid |
| `kind` | `student` \| `staff` \| `contractor` \| `security_guard` \| `control_room` \| `org_admin` \| `other` | UI labels map here |
| `status` | `invited` \| `active` \| `suspended` \| `revoked` | |
| `permissions` | string[] | Fine-grained flags (Phase 2+) |
| `createdAt` / `updatedAt` | number | |

A user may have multiple memberships across organizations (rare) or sites.

### Responder

Authorised operational identity. **Installing the app is not sufficient.**

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | May align with `responderUnits` initially |
| `organizationId` | string | Required |
| `siteId` | string | Primary campus |
| `zoneIds` | string[] | Response zones |
| `userId` | string | Linked account |
| `membershipId` | string | Must be active security membership |
| `unitCode` | string | Callsign / unit ID |
| `responderType` | string | Org-scoped type, e.g. `campus_security` — not public police/EMS enums |
| `approvalStatus` | `pending` \| `approved` \| `rejected` \| `revoked` | |
| `employmentStatus` | `active` \| `inactive` | |
| `deviceBindingRequired` | boolean | Pair with `operationalDevices` |
| `createdAt` / `updatedAt` | number | |

**Dispatch eligibility:** active membership + `approvalStatus === approved` + employment active + site assignment + permissions + device gate (when required).

### Incident (scoped)

Extend existing incident shape; do not replace the status machine.

| Additional field | Type | Notes |
|------------------|------|-------|
| `organizationId` | string | **Required** |
| `siteId` | string | **Required** for campus incidents |
| `zoneId` | string \| null | Detected or selected zone |
| `category` | string | Extend beyond sos/security/medical later |
| `mode` | `standard` \| `silent` \| `discreet` | Future |
| `locationSessionId` | string \| null | Formalised track session |

### Dispatch / Assignment

Reuse existing `assignments[]` on incident. Scope implied via parent incident’s `organizationId` / `siteId`.

### Response team

Logical grouping of responders for an incident (Phase 2+). Initially: `assignments[]` is the team.

### Escalation

Timeline already allows `escalated`. Phase 2+: structured escalation to control room with reason and target role.

### Location session

Formalises today’s incident location trail (`incidentTracks` / `appendIncidentLocation`).

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | |
| `organizationId` | string | |
| `siteId` | string | |
| `incidentId` | string | |
| `userId` | string | Subject |
| `status` | `active` \| `ended` | |
| `startedAt` / `endedAt` | number | |

### Trusted contact

Conceptual rename of `EmergencyContact` (`users/{uid}/emergencyContacts`). Phase 2+: consent, share windows, privacy controls.

### Notification

Every notification record / fan-out target must be scoped by `organizationId` (and usually `siteId` / role).

### Audit event

Prefer append-only timeline + platform audit log:

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | |
| `organizationId` | string \| null | Null only for platform-level super-admin actions |
| `siteId` | string \| null | |
| `actorUserId` | string | |
| `action` | string | |
| `resourceType` / `resourceId` | string | |
| `timestamp` | number | |
| `metadata` | object | |

### Integration provider (stub)

Future external responders (police, ambulance, private security).

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | |
| `organizationId` | string | |
| `kind` | `police` \| `ambulance` \| `private_security` \| `other` | |
| `status` | `disabled` \| `configured` \| `active` | Phase 1: types only, no implementations |
| `config` | object | Provider-specific, never hard-coded into core dispatch |

## Auth claims (target)

| Claim | Who | Purpose |
|-------|-----|---------|
| `role` | All | Coarse app role (compat with today) |
| `organizationId` | Org-scoped users | Tenant isolation |
| `siteIds` | Guards / campus staff | Campus scope |
| `membershipIds` | Optional | Fast checks |
| `unitId` | Responders | Existing unit binding |
| `platformAdmin` | Super-admin only | Cross-tenant platform access |

Super-admin operates only on the **platform** dashboard surface, not inside a university ops chrome.

## Firestore path conventions (proposed)

```
organizations/{organizationId}
organizations/{organizationId}/sites/{siteId}
organizations/{organizationId}/sites/{siteId}/zones/{zoneId}
organizations/{organizationId}/memberships/{membershipId}
organizations/{organizationId}/responders/{responderId}
incidents/{incidentId}          # keep top-level for query patterns; require organizationId + siteId fields
auditEvents/{eventId}
integrationProviders/{providerId}
```

Phase 1 ships TypeScript types in `packages/domain` only. Collection migration and rules land in Phase 2.

## Tenant isolation rules

1. Every database query, incident, responder assignment, notification, and analytics record is scoped to the correct `organizationId`.
2. Campus-level features additionally filter by `siteId`.
3. Platform super-admin is the only cross-tenant actor.
4. Firestore rules and Cloud Functions must enforce the same checks (client filters are not sufficient).

## Label mapping (UI only)

| Internal | University UI |
|----------|---------------|
| Organization | University |
| Site | Campus |
| Zone | Building / zone |
| Membership kind `student` | Student |
| Membership kind `staff` | University employee |
| Membership kind `contractor` | Contractor |
| Membership kind `security_guard` | Security guard |
| Membership kind `control_room` | Control-room operator |
| Membership kind `org_admin` | University safety administrator |
| platformAdmin | Seren platform administrator |
