/**
 * Ride safety foundation — create/list only (Phase G).
 * No matching engine, no Express SOS coupling.
 */
import { HttpsError } from 'firebase-functions/v2/https';
import type { RequestContext } from '../middleware/requestContext';
import { authorizeAnyPermission } from '../middleware/requestContext';
import { assertModuleEnabled } from './moduleGate';
import { COLLECTIONS } from './collections';
import { getDb } from '../firebaseApps';
import { ensurePersonForClerkUser } from './personService';
import { recordAnalyticsEvent } from '../analytics/recordAnalyticsEvent';

const db = getDb();

export async function createRideSafetyRequest(
  context: RequestContext,
  input: {
    pickupLabel?: string | null;
    destinationLabel?: string | null;
    notes?: string | null;
    escortRequested?: boolean;
  }
) {
  await assertModuleEnabled(context.organizationId, 'RIDE_SAFETY');
  // Reuse soft permission — members with incidents:create or requests:create may request escort
  authorizeAnyPermission(context, ['incidents:create', 'requests:create', 'incidents:read-own']);

  try {
    await ensurePersonForClerkUser({ clerkUserId: context.userId });
  } catch (err) {
    console.error('ensurePersonForClerkUser on ride safety create failed (non-fatal)', err);
  }

  const now = Date.now();
  const ref = db.collection(COLLECTIONS.rideSafetyRequests).doc();
  const request = {
    id: ref.id,
    organizationId: context.organizationId,
    siteId: context.siteId || null,
    zoneId: null,
    requesterUserId: context.userId,
    requesterPersonId: context.userId,
    status: 'requested' as const,
    pickupLabel: input.pickupLabel ? String(input.pickupLabel).slice(0, 200) : null,
    destinationLabel: input.destinationLabel
      ? String(input.destinationLabel).slice(0, 200)
      : null,
    notes: input.notes ? String(input.notes).slice(0, 2000) : null,
    escortRequested: input.escortRequested !== false,
    assignedUserId: null,
    createdAt: now,
    updatedAt: now,
    acceptedAt: null,
    completedAt: null,
    cancelledAt: null,
  };

  await ref.set(request);
  await recordAnalyticsEvent({
    organizationId: context.organizationId,
    siteId: context.siteId || null,
    kind: 'ride_safety_requested',
    category: 'ride_safety',
    resourceType: 'rideSafetyRequest',
    resourceId: ref.id,
  });

  return request;
}

export async function listRideSafetyRequests(
  context: RequestContext,
  options?: { ownOnly?: boolean; limit?: number; status?: string }
) {
  await assertModuleEnabled(context.organizationId, 'RIDE_SAFETY');

  const ownOnly = options?.ownOnly === true;
  if (ownOnly) {
    authorizeAnyPermission(context, ['incidents:create', 'requests:create', 'incidents:read-own']);
  } else {
    authorizeAnyPermission(context, [
      'incidents:read-all',
      'requests:read-all',
      'responders:read',
    ]);
  }

  const limit = Math.min(Math.max(Number(options?.limit) || 50, 1), 100);
  let query = db
    .collection(COLLECTIONS.rideSafetyRequests)
    .where('organizationId', '==', context.organizationId);

  if (ownOnly) {
    query = query.where('requesterPersonId', '==', context.userId);
  }
  if (options?.status) {
    query = query.where('status', '==', options.status);
  }

  const list = await query.orderBy('createdAt', 'desc').limit(limit).get();
  return {
    organizationId: context.organizationId,
    requests: list.docs.map(d => d.data()),
  };
}
