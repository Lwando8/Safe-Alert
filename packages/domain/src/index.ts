/**
 * @seren/domain — generic internal types.
 * UI may label Organization as University, Site as Campus, etc.
 * Do not hard-code university-only vocabulary into these types.
 */

export * from './tenantConfig';
export * from './collections';
export * from './personIdentity';
export * from './entitlements';
export * from './accessGrants';
export * from './responderCapabilities';
export * from './sla';
export {
  type TenantProfile,
  type PlatformModule,
  type ModuleFlags,
  type OperationalCategoryDef,
  type CommunityAlertCategoryDef,
  type TerminologyPack,
  type OrganizationModuleSettings,
  TENANT_PROFILES,
  PLATFORM_MODULES,
  isTenantProfile,
  isPlatformModule,
  defaultModulesForProfile,
  defaultTerminologyForProfile,
  defaultOperationalCategories,
  defaultCommunityAlertCategories,
  resolveEffectiveModules,
  isModuleEnabled,
  resolveTerminology,
  resolveOperationalCategories,
  resolveCommunityAlertCategories,
  buildOrganizationTenantDefaults,
} from './tenantConfig';
export { COLLECTIONS, type CollectionName } from './collections';
export {
  type Person,
  type PersonStatus,
  type IdentityAccount,
  type IdentityProvider,
  personIdFromClerkUserId,
  clerkUserIdFromPersonId,
  clerkIdentityAccountId,
  firebaseIdentityAccountId,
  identityAccountsFromLink,
  buildPersonRecord,
} from './personIdentity';
export {
  type Entitlement,
  type EntitlementSource,
  type EntitlementStatus,
  resolvePersonEntitlements,
  personHasModuleEntitlement,
} from './entitlements';
export {
  type IncidentAccessGrant,
  type IncidentAccessPermission,
  type ConsentGrant,
  type ConsentPurpose,
  type ConsentDataCategory,
  INCIDENT_ACCESS_GRACE_MS,
  isIncidentAccessGrantActive,
  grantAllowsPermission,
  buildAcceptIncidentAccessGrant,
  isConsentGrantActive,
  WORK_STATUS_VOCABULARY,
} from './accessGrants';

import type {
  ModuleFlags,
  OperationalCategoryDef,
  CommunityAlertCategoryDef,
  TerminologyPack,
  TenantProfile,
} from './tenantConfig';

export type EntityStatus = 'active' | 'inactive' | 'suspended' | 'provisioning';

export type OrganizationStatus = 'active' | 'suspended' | 'provisioning';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  /** Tenant profile drives defaults; modules override in settings. */
  tenantProfile?: TenantProfile;
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
  /** @deprecated Prefer typed `modules` */
  features?: Record<string, boolean>;
  modules?: Partial<ModuleFlags>;
  operationalCategories?: OperationalCategoryDef[];
  communityAlertCategories?: CommunityAlertCategoryDef[];
  terminology?: Partial<TerminologyPack>;
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
  | 'facilities'
  | 'resident'
  | 'other';

export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'revoked';

export interface Membership {
  id: string;
  organizationId: string;
  siteId?: string | null;
  /**
   * Auth-linked user id. On the migrated Clerk path this equals personId
   * (compat: personId === clerkUserId). Prefer personId when writing new code.
   */
  userId: string;
  /** Hybrid person id — defaults to userId when omitted (compat). */
  personId?: string;
  kind: MembershipKind;
  status: MembershipStatus;
  permissions?: string[];
  teamIds?: string[];
  createdAt: number;
  updatedAt: number;
}

export type TeamKind =
  | 'security'
  | 'medical'
  | 'fire'
  | 'facilities'
  | 'maintenance'
  | 'electrical'
  | 'plumbing'
  | 'cleaning'
  | 'grounds'
  | 'it'
  | 'estate'
  | 'campus_operations'
  | 'contractor'
  | 'other';

export interface Team {
  id: string;
  organizationId: string;
  siteId?: string | null;
  name: string;
  kind: TeamKind;
  status: 'active' | 'inactive';
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
  teamId?: string | null;
  userId: string;
  /** Hybrid person id — defaults to userId when omitted (compat). */
  personId?: string;
  membershipId: string;
  unitCode: string;
  /**
   * Org-scoped type. Prefer SECURITY / MEDICAL / MAINTENANCE / FACILITIES / …
   * Legacy values like campus_security remain valid.
   */
  responderType: string;
  /** Capability tags that gate assignment eligibility (additive). */
  capabilities?: string[];
  approvalStatus: ResponderApprovalStatus;
  employmentStatus: EmploymentStatus;
  deviceBindingRequired?: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Canonical responder type vocabulary (non-breaking; strings remain open). */
export const RESPONDER_TYPES = [
  'SECURITY',
  'POLICE',
  'MEDICAL',
  'FIRE',
  'MAINTENANCE',
  'FACILITIES',
  'IT',
  'OTHER',
  'campus_security',
] as const;

export type ResponderCapability =
  | 'INCIDENT_RESPONSE'
  | 'PATROL'
  | 'ACCESS_CONTROL'
  | 'PLUMBING'
  | 'ELECTRICAL'
  | 'GENERAL_MAINTENANCE'
  | 'IT_SUPPORT'
  | 'CLEANING'
  | string;

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

export type OperationalRequestStatus =
  | 'submitted'
  | 'acknowledged'
  | 'assigned'
  | 'in_progress'
  | 'awaiting_information'
  | 'on_hold'
  | 'resolved'
  | 'closed';

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface AttachmentMeta {
  id: string;
  contentType?: string;
  storagePath?: string;
  url?: string;
  createdAt: number;
}

export interface OperationalRequest {
  id: string;
  organizationId: string;
  siteId: string;
  zoneId?: string | null;
  reporterUserId: string;
  category: string;
  title: string;
  description: string;
  status: OperationalRequestStatus;
  priority: Priority;
  location?: GeoPoint | null;
  locationLabel?: string | null;
  attachments?: AttachmentMeta[];
  assignedTeamId?: string | null;
  assignedUserId?: string | null;
  workOrderId?: string | null;
  createdAt: number;
  updatedAt: number;
  acknowledgedAt?: number | null;
  assignedAt?: number | null;
  workStartedAt?: number | null;
  resolvedAt?: number | null;
  closedAt?: number | null;
  resolutionSummary?: string | null;
}

export interface WorkOrder {
  id: string;
  organizationId: string;
  siteId: string;
  zoneId?: string | null;
  requestId: string;
  category: string;
  assignedTeamId?: string | null;
  assignedUserId?: string | null;
  priority: Priority;
  status: OperationalRequestStatus;
  slaTargetAt?: number | null;
  notes?: string | null;
  attachments?: AttachmentMeta[];
  resolutionSummary?: string | null;
  createdAt: number;
  updatedAt: number;
  acceptedAt?: number | null;
  workStartedAt?: number | null;
  resolvedAt?: number | null;
}

export type CommunityGroupVisibility = 'members' | 'organization';

export interface CommunityGroup {
  id: string;
  organizationId: string;
  siteId?: string | null;
  zoneId?: string | null;
  name: string;
  description?: string;
  category: string;
  visibility: CommunityGroupVisibility;
  status: 'active' | 'inactive' | 'archived';
  organiserUserIds: string[];
  memberUserIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface CommunityEvent {
  id: string;
  organizationId: string;
  siteId?: string | null;
  groupId?: string | null;
  title: string;
  description?: string;
  startsAt: number;
  endsAt?: number | null;
  locationLabel?: string | null;
  location?: GeoPoint | null;
  organiserUserId: string;
  status: 'scheduled' | 'cancelled' | 'completed';
  createdAt: number;
  updatedAt: number;
}

export type CommunityAlertType =
  | 'MISSING_PET'
  | 'FOUND_PET'
  | 'LOST_PROPERTY'
  | 'FOUND_PROPERTY'
  | 'COMMUNITY_ASSISTANCE'
  | 'NOTICE';

export type CommunityAlertStatus = 'open' | 'resolved' | 'closed';

export interface CommunityAlert {
  id: string;
  organizationId: string;
  siteId?: string | null;
  zoneId?: string | null;
  type: CommunityAlertType;
  status: CommunityAlertStatus;
  title: string;
  description: string;
  reporterUserId: string;
  /** Public contact preference — never auto-fill email/phone from profile */
  contactMethod?: string | null;
  location?: GeoPoint | null;
  locationLabel?: string | null;
  attachments?: AttachmentMeta[];
  /** Missing-pet / property extras */
  details?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number | null;
}

export interface AlertSighting {
  id: string;
  organizationId: string;
  alertId: string;
  reporterUserId: string;
  note: string;
  seenAt: number;
  location?: GeoPoint | null;
  locationLabel?: string | null;
  attachments?: AttachmentMeta[];
  createdAt: number;
}

export type BroadcastSeverity = 'info' | 'warning' | 'emergency';

/** Official organisation broadcast — distinct from CommunityAlert */
export interface Broadcast {
  id: string;
  organizationId: string;
  siteId?: string | null;
  title: string;
  body: string;
  severity: BroadcastSeverity;
  createdByUserId: string;
  status: 'draft' | 'published' | 'retracted';
  publishedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export type AnalyticsEventKind =
  | 'incident_created'
  | 'incident_resolved'
  | 'request_created'
  | 'request_assigned'
  | 'request_resolved'
  | 'community_alert_created'
  | 'community_alert_resolved'
  | 'broadcast_published'
  | 'sla_missed'
  | 'sla_met';

export interface AnalyticsEvent {
  id: string;
  organizationId: string;
  siteId?: string | null;
  zoneId?: string | null;
  kind: AnalyticsEventKind;
  category?: string | null;
  teamId?: string | null;
  resourceType: string;
  resourceId: string;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
  createdAt: number;
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
  /** Hybrid person id of actor when known */
  actorPersonId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  timestamp: number;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  reason?: string | null;
  accessGrantId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Canonical work-management audit actions */
export const WORK_AUDIT_ACTIONS = [
  'report_created',
  'priority_changed',
  'work_assigned',
  'work_reassigned',
  'work_accepted',
  'work_declined',
  'work_started',
  'work_blocked',
  'work_resolved',
  'work_closed',
] as const;

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
