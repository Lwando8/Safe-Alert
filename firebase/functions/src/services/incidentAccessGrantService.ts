import { HttpsError } from 'firebase-functions/v2/https';
import { getDb } from '../firebaseApps';
import { COLLECTIONS } from './collections';
import {
  isIncidentAccessGrantActive,
  grantAllowsPermission,
  type IncidentAccessGrant,
  type IncidentAccessPermission,
} from './accessGrants';

const db = getDb();

export function incidentAccessGrantId(incidentId: string, personId: string): string {
  return `iag_${incidentId}_${personId}`;
}

export async function loadIncidentAccessGrant(
  incidentId: string,
  personId: string
): Promise<IncidentAccessGrant | null> {
  const id = incidentAccessGrantId(incidentId, personId);
  const snap = await db.doc(`${COLLECTIONS.incidentAccessGrants}/${id}`).get();
  if (!snap.exists) return null;
  return snap.data() as IncidentAccessGrant;
}

export async function requireActiveIncidentAccessGrant(input: {
  incidentId: string;
  personId: string;
  permission: IncidentAccessPermission;
  organizationId?: string;
}): Promise<IncidentAccessGrant> {
  const grant = await loadIncidentAccessGrant(input.incidentId, input.personId);
  if (!grant || !isIncidentAccessGrantActive(grant)) {
    throw new HttpsError(
      'permission-denied',
      'No active incident access grant. Membership may be revoked and no emergency grant applies.'
    );
  }
  if (
    input.organizationId &&
    grant.granteeOrganisationId !== input.organizationId
  ) {
    throw new HttpsError('permission-denied', 'Incident access grant tenant mismatch');
  }
  if (!grantAllowsPermission(grant, input.permission)) {
    throw new HttpsError(
      'permission-denied',
      `Incident access grant missing permission: ${input.permission}`
    );
  }
  return grant;
}
