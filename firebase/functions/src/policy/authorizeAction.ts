/**
 * Named authorization actions — wraps RequestContext authorize helpers.
 * Does not replace all inline checks in one pass; prefer for new code paths.
 */
import { HttpsError } from 'firebase-functions/v2/https';
import type { RequestContext } from '../middleware/requestContext';
import {
  authorize,
  authorizeAnyPermission,
  requireTenantMatch,
} from '../middleware/requestContext';
import { assertModuleEnabled } from '../services/moduleGate';
import type { PlatformModule } from '../services/tenantConfig';
import {
  grantAllowsPermission,
  isIncidentAccessGrantActive,
  type IncidentAccessGrant,
  type IncidentAccessPermission,
} from '../services/accessGrants';

export type PolicyAction =
  | 'view_incident'
  | 'accept_incident'
  | 'assign_incident'
  | 'update_incident'
  | 'create_request'
  | 'view_request'
  | 'assign_request'
  | 'update_request'
  | 'resolve_request'
  | 'create_broadcast'
  | 'view_broadcast';

const ACTION_PERMISSIONS: Record<PolicyAction, string[]> = {
  view_incident: ['incidents:read-all', 'incidents:read-own', 'incidents:acknowledge'],
  accept_incident: ['incidents:acknowledge', 'incidents:update'],
  assign_incident: ['incidents:assign'],
  update_incident: ['incidents:update'],
  create_request: ['requests:create'],
  view_request: ['requests:read-all', 'requests:read-own'],
  assign_request: ['requests:assign'],
  update_request: ['requests:update', 'requests:assign', 'requests:resolve'],
  resolve_request: ['requests:resolve'],
  create_broadcast: ['broadcasts:create'],
  view_broadcast: ['broadcasts:read'],
};

const ACTION_MODULES: Partial<Record<PolicyAction, PlatformModule>> = {
  create_request: 'OPERATIONS',
  view_request: 'OPERATIONS',
  assign_request: 'OPERATIONS',
  update_request: 'OPERATIONS',
  resolve_request: 'OPERATIONS',
  create_broadcast: 'BROADCASTS',
  view_broadcast: 'BROADCASTS',
};

export async function authorizeAction(
  context: RequestContext,
  action: PolicyAction,
  options?: {
    resourceOrganizationId?: string;
    /** When membership may be revoked, allow if a valid incident grant exists */
    incidentGrant?: IncidentAccessGrant | null;
    incidentPermission?: IncidentAccessPermission;
  }
): Promise<void> {
  if (options?.resourceOrganizationId) {
    // Prefer grant escape hatch before hard tenant match failure on revoked membership —
    // only when grant is present and active for same org.
    if (
      options.incidentGrant &&
      options.incidentGrant.granteeOrganisationId === options.resourceOrganizationId &&
      isIncidentAccessGrantActive(options.incidentGrant)
    ) {
      const perm = options.incidentPermission || 'incident:read';
      if (grantAllowsPermission(options.incidentGrant, perm)) {
        return;
      }
    }
    requireTenantMatch(context, options.resourceOrganizationId);
  }

  const module = ACTION_MODULES[action];
  if (module) {
    await assertModuleEnabled(context.organizationId, module);
  }

  const perms = ACTION_PERMISSIONS[action];
  if (!perms?.length) {
    throw new HttpsError('internal', `Unknown policy action: ${action}`);
  }
  if (perms.length === 1) {
    authorize(context, { permission: perms[0]! });
  } else {
    authorizeAnyPermission(context, perms);
  }
}
