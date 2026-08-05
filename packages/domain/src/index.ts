/**
 * @seren/domain — generic internal types.
 * UI may label Organization as University, Site as Campus, etc.
 * Do not hard-code university-only vocabulary into these types.
 */

export type EntityStatus = 'active' | 'inactive' | 'suspended' | 'provisioning';

export type OrganizationStatus = 'active' | 'suspended' | 'provisioning';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  settings?: OrganizationSettings;
  createdAt: number;
  updatedAt: number;
}

export interface OrganizationSettings {
  dataRetentionDays?: number;
  branding?: {
    displayName?: string;
    primaryColor?: string;
    logoUrl?: string;
  };
  features?: Record<string, boolean>;
}

export interface Site {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  timezone?: string;
  status: 'active' | 'inactive';
  bounds?: SiteBounds | null;
  createdAt: number;
  updatedAt: number;
}

export interface SiteBounds {
  /** [west, south, east, north] */
  bbox?: [number, number, number, number];
  center?: { latitude: number; longitude: number };
}

export type ZoneKind = 'building' | 'geofence' | 'response_zone' | 'other';

export interface Zone {
  id: string;
  organizationId: string;
  siteId: string;
  name: string;
  kind: ZoneKind;
  geometry?: ZoneGeometry | null;
  createdAt: number;
  updatedAt: number;
}

export interface ZoneGeometry {
  type: 'polygon' | 'circle';
  /** GeoJSON-like coordinates or circle center + radiusMeters */
  coordinates?: number[][][];
  center?: { latitude: number; longitude: number };
  radiusMeters?: number;
}

export type MembershipKind =
  | 'student'
  | 'staff'
  | 'contractor'
  | 'security_guard'
  | 'control_room'
  | 'org_admin'
  | 'other';

export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'revoked';

export interface Membership {
  id: string;
  organizationId: string;
  siteId?: string | null;
  userId: string;
  kind: MembershipKind;
  status: MembershipStatus;
  permissions?: string[];
  createdAt: number;
  updatedAt: number;
}

export type ResponderApprovalStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export type EmploymentStatus = 'active' | 'inactive';

/**
 * Authorised operational responder identity.
 * Installing a client app does not grant dispatch eligibility.
 */
export interface Responder {
  id: string;
  organizationId: string;
  siteId: string;
  zoneIds?: string[];
  userId: string;
  membershipId: string;
  unitCode: string;
  /** Org-scoped type (e.g. campus_security). Not public police/EMS product enums. */
  responderType: string;
  approvalStatus: ResponderApprovalStatus;
  employmentStatus: EmploymentStatus;
  deviceBindingRequired?: boolean;
  createdAt: number;
  updatedAt: number;
}

export type IncidentMapStatus = 'unassigned' | 'dispatched' | 'resolved';

export type IncidentLifecycleStatus = 'open' | 'resolved' | 'cancelled';

export type IncidentMode = 'standard' | 'silent' | 'discreet';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * Tenant-scoped incident fields to add alongside the existing dispatch shape.
 * Does not replace the assignment status machine.
 */
export interface TenantScopedIncident {
  id: string;
  organizationId: string;
  siteId: string;
  zoneId?: string | null;
  userId: string;
  type: string;
  category?: string;
  mode?: IncidentMode;
  status: IncidentLifecycleStatus | string;
  mapStatus?: IncidentMapStatus | string;
  location: GeoPoint;
  lastLocation?: GeoPoint;
  locationSessionId?: string | null;
  providerId?: string | null;
  assignments?: unknown[];
  meta?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export type LocationSessionStatus = 'active' | 'ended';

export interface LocationSession {
  id: string;
  organizationId: string;
  siteId: string;
  incidentId: string;
  userId: string;
  status: LocationSessionStatus;
  startedAt: number;
  endedAt?: number | null;
}

export interface TrustedContact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  relationship?: string;
  isPrimary?: boolean;
  /** Future: consent / share window metadata */
  consentGrantedAt?: number | null;
}

export interface NotificationRecord {
  id: string;
  organizationId: string;
  siteId?: string | null;
  userId: string;
  channel: 'push' | 'sms' | 'email' | 'in_app';
  kind: string;
  payload?: Record<string, unknown>;
  createdAt: number;
}

export interface AuditEvent {
  id: string;
  /** Null only for platform-level super-admin actions */
  organizationId?: string | null;
  siteId?: string | null;
  actorUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export type IntegrationProviderKind =
  | 'police'
  | 'ambulance'
  | 'private_security'
  | 'university_system'
  | 'other';

export type IntegrationProviderStatus = 'disabled' | 'configured' | 'active';

/** Stub only in Phase 1 — no external integrations wired. */
export interface IntegrationProvider {
  id: string;
  organizationId: string;
  kind: IntegrationProviderKind;
  status: IntegrationProviderStatus;
  displayName: string;
  config?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/** Target custom-claim shape for tenant-aware clients. */
export interface SerenAuthClaims {
  role?: string;
  organizationId?: string | null;
  siteIds?: string[];
  membershipIds?: string[];
  unitId?: string | null;
  platformAdmin?: boolean;
}

/**
 * Dispatch eligibility checklist (documentation as code).
 * All must pass before acceptIncident / operational status.
 */
export interface ResponderEligibility {
  hasActiveMembership: boolean;
  approvalStatus: ResponderApprovalStatus;
  employmentStatus: EmploymentStatus;
  hasSiteAssignment: boolean;
  deviceGatePassed: boolean;
  permissionsSatisfied: boolean;
}

export function isResponderDispatchEligible(e: ResponderEligibility): boolean {
  return (
    e.hasActiveMembership &&
    e.approvalStatus === 'approved' &&
    e.employmentStatus === 'active' &&
    e.hasSiteAssignment &&
    e.deviceGatePassed &&
    e.permissionsSatisfied
  );
}

/** UI label helpers — presentation only; do not use as storage keys. */
export const UNIVERSITY_LABELS = {
  organization: 'University',
  site: 'Campus',
  zone: 'Zone',
  student: 'Student',
  staff: 'University employee',
  contractor: 'Contractor',
  security_guard: 'Security guard',
  control_room: 'Control-room operator',
  org_admin: 'University safety administrator',
  platform_admin: 'Seren platform administrator',
} as const;
