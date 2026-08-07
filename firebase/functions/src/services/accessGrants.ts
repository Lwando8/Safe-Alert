/**
 * Access grants and consent boundaries.
 * Types + pure helpers only for consent; incident grants include validity rules.
 */

export type IncidentAccessPermission =
  | 'incident:read'
  | 'incident:update'
  | 'incident:location'
  | 'incident:assign';

export interface IncidentAccessGrant {
  id: string;
  incidentId: string;
  subjectPersonId: string;
  granteeOrganisationId: string;
  granteeResponderId?: string | null;
  granteePersonId?: string | null;
  permissions: IncidentAccessPermission[];
  validFrom: number;
  validUntil: number;
  grantReason: string;
  sourceMembershipId?: string | null;
  revokedAt?: number | null;
  createdAt: number;
}

/** Default grace after resolution before grant expires (ms). */
export const INCIDENT_ACCESS_GRACE_MS = 2 * 60 * 60 * 1000; // 2 hours

export function isIncidentAccessGrantActive(
  grant: IncidentAccessGrant,
  now: number = Date.now()
): boolean {
  if (grant.revokedAt != null) return false;
  if (now < grant.validFrom) return false;
  if (now > grant.validUntil) return false;
  return true;
}

export function grantAllowsPermission(
  grant: IncidentAccessGrant,
  permission: IncidentAccessPermission,
  now: number = Date.now()
): boolean {
  return isIncidentAccessGrantActive(grant, now) && grant.permissions.includes(permission);
}

/**
 * Build a grant issued when a responder accepts an active incident.
 * Survives later membership revocation until validUntil / revoke.
 */
export function buildAcceptIncidentAccessGrant(input: {
  incidentId: string;
  subjectPersonId: string;
  granteeOrganisationId: string;
  granteePersonId: string;
  granteeResponderId?: string | null;
  sourceMembershipId?: string | null;
  now?: number;
  /** If incident already resolved, grace starts now; else long-lived until resolve+grace. */
  incidentResolved?: boolean;
  graceMs?: number;
}): IncidentAccessGrant {
  const now = input.now ?? Date.now();
  const grace = input.graceMs ?? INCIDENT_ACCESS_GRACE_MS;
  // While open: valid for 7 days max; after resolve: grace window
  const validUntil = input.incidentResolved ? now + grace : now + 7 * 24 * 60 * 60 * 1000;
  return {
    id: `iag_${input.incidentId}_${input.granteePersonId}`,
    incidentId: input.incidentId,
    subjectPersonId: input.subjectPersonId,
    granteeOrganisationId: input.granteeOrganisationId,
    granteeResponderId: input.granteeResponderId ?? null,
    granteePersonId: input.granteePersonId,
    permissions: ['incident:read', 'incident:update', 'incident:location'],
    validFrom: now,
    validUntil,
    grantReason: 'incident_accepted',
    sourceMembershipId: input.sourceMembershipId ?? null,
    revokedAt: null,
    createdAt: now,
  };
}

export type ConsentPurpose =
  | 'emergency_response'
  | 'membership_profile'
  | 'location_share'
  | 'marketing'
  | 'other';

export type ConsentDataCategory =
  | 'profile'
  | 'location_live'
  | 'location_last_known'
  | 'medical'
  | 'contact'
  | 'other';

export interface ConsentGrant {
  id: string;
  subjectPersonId: string;
  recipientOrganisationId?: string | null;
  recipientEntity?: string | null;
  purpose: ConsentPurpose;
  dataCategories: ConsentDataCategory[];
  legalBasis?: string | null;
  validFrom: number;
  validUntil?: number | null;
  revocable: boolean;
  revokedAt?: number | null;
  source?: string | null;
  createdAt: number;
}

export function isConsentGrantActive(
  grant: ConsentGrant,
  now: number = Date.now()
): boolean {
  if (grant.revokedAt != null) return false;
  if (now < grant.validFrom) return false;
  if (grant.validUntil != null && now > grant.validUntil) return false;
  return true;
}

/** Work-management vocabulary map (stored enums unchanged). */
export const WORK_STATUS_VOCABULARY: Record<string, string> = {
  submitted: 'NEW',
  acknowledged: 'TRIAGED',
  assigned: 'ASSIGNED',
  in_progress: 'IN_PROGRESS',
  awaiting_information: 'BLOCKED',
  on_hold: 'BLOCKED',
  resolved: 'RESOLVED',
  closed: 'CLOSED',
};
