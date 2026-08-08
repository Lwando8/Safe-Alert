import { HttpsError } from 'firebase-functions/v2/https';
import { getDb } from '../firebaseApps';

const db = getDb();

export interface MembershipRecord {
  id: string;
  clerkMembershipId: string;
  clerkOrganizationId: string;
  organizationId: string;
  userId: string;
  siteId: string;
  zoneIds?: string[];
  kind: string;
  status: string;
  clerkRole: string;
  permissions: string[];
  responderProfile?: {
    unitCode?: string;
    responderType?: string;
    capabilities?: string[];
    approvalStatus?: string;
    employmentStatus?: string;
    deviceBindingRequired?: boolean;
  };
}

function asMembershipRecord(id: string, raw: Record<string, unknown>): MembershipRecord {
  return {
    id,
    clerkMembershipId: String(raw.clerkMembershipId || ''),
    clerkOrganizationId: String(raw.clerkOrganizationId || ''),
    organizationId: String(raw.organizationId || ''),
    userId: String(raw.userId || ''),
    siteId: String(raw.siteId || ''),
    zoneIds: Array.isArray(raw.zoneIds) ? (raw.zoneIds as string[]) : undefined,
    kind: String(raw.kind || ''),
    status: String(raw.status || ''),
    clerkRole: String(raw.clerkRole || ''),
    permissions: Array.isArray(raw.permissions) ? (raw.permissions as string[]) : [],
    responderProfile: raw.responderProfile as MembershipRecord['responderProfile'],
  };
}

/**
 * Classify non-active membership access for explicit mobile session states.
 */
export async function classifyMembershipAccess(userId: string): Promise<{
  state: 'no_membership' | 'pending_access' | 'revoked';
  membershipId?: string;
  organizationId?: string;
  status?: string;
}> {
  const snap = await db
    .collection('memberships')
    .where('userId', '==', userId)
    .limit(25)
    .get();

  if (snap.empty) {
    return { state: 'no_membership' };
  }

  const rows = snap.docs.map(doc => ({
    id: doc.id,
    data: asMembershipRecord(doc.id, doc.data() as Record<string, unknown>),
  }));

  const pending = rows.find(r => r.data.status === 'invited' || r.data.status === 'pending');
  if (pending) {
    return {
      state: 'pending_access',
      membershipId: pending.id,
      organizationId: pending.data.organizationId,
      status: pending.data.status,
    };
  }

  const revoked = rows.find(r => r.data.status === 'revoked' || r.data.status === 'suspended');
  if (revoked) {
    return {
      state: 'revoked',
      membershipId: revoked.id,
      organizationId: revoked.data.organizationId,
      status: revoked.data.status,
    };
  }

  return { state: 'no_membership' };
}

/**
 * Load exactly one active membership for a user.
 * organizationIdHint (e.g. Firebase claim) may narrow candidates but cannot
 * invent an org or override a non-matching membership set.
 */
export async function loadActiveMembershipForUser(params: {
  userId: string;
  organizationId?: string;
  organizationIdHint?: string;
}): Promise<{ id: string; data: MembershipRecord }> {
  const { userId, organizationId, organizationIdHint } = params;

  if (organizationId) {
    const snap = await db
      .collection('memberships')
      .where('userId', '==', userId)
      .where('organizationId', '==', organizationId)
      .where('status', '==', 'active')
      .limit(2)
      .get();

    if (snap.empty) {
      throw new HttpsError(
        'failed-precondition',
        'No active membership found for this organization. Your membership may be suspended or revoked.'
      );
    }
    if (snap.size > 1) {
      throw new HttpsError(
        'failed-precondition',
        'Ambiguous membership mapping. Access denied.'
      );
    }
    const doc = snap.docs[0];
    return { id: doc.id, data: asMembershipRecord(doc.id, doc.data() as Record<string, unknown>) };
  }

  const allActive = await db
    .collection('memberships')
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .limit(10)
    .get();

  if (allActive.empty) {
    throw new HttpsError(
      'failed-precondition',
      'No active membership found. Your membership may be suspended or revoked.'
    );
  }

  if (organizationIdHint) {
    const matched = allActive.docs.filter(
      d => String((d.data() as Record<string, unknown>).organizationId || '') === organizationIdHint
    );
    if (matched.length === 1) {
      const doc = matched[0];
      return { id: doc.id, data: asMembershipRecord(doc.id, doc.data() as Record<string, unknown>) };
    }
    if (matched.length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'Claimed organization does not match an active membership. Access denied.'
      );
    }
    throw new HttpsError(
      'failed-precondition',
      'Ambiguous membership mapping. Access denied.'
    );
  }

  if (allActive.size === 1) {
    const doc = allActive.docs[0];
    return { id: doc.id, data: asMembershipRecord(doc.id, doc.data() as Record<string, unknown>) };
  }

  throw new HttpsError(
    'failed-precondition',
    'Multiple active memberships and no unambiguous organization. Select an organization or use Clerk session.'
  );
}
