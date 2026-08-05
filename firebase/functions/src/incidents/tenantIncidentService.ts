import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import type { RequestContext } from '../middleware/requestContext';
import { authorize, requireTenantMatch } from '../middleware/requestContext';
import { getDb, getRtdb } from '../firebaseApps';

const db = getDb();

export type IncidentType = 'sos' | 'medical' | 'security';

export function actorUid(context: RequestContext): string {
  return context.firebaseUid || context.userId;
}

export async function loadIncidentInTenant(incidentId: string, context: RequestContext) {
  const ref = db.doc(`incidents/${incidentId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Incident not found');
  const data = snap.data() as Record<string, unknown>;
  requireTenantMatch(context, data.organizationId as string | undefined);
  return { ref, data };
}

/**
 * Create an incident stamped ONLY from server RequestContext.
 * Client organizationId / siteId / providerId hints are ignored.
 */
export async function createTenantIncident(
  context: RequestContext,
  input: {
    type: string;
    location: { latitude: number; longitude: number };
    meta?: Record<string, unknown>;
  }
) {
  authorize(context, { permission: 'incidents:create' });

  if (!input.type || !input.location?.latitude || !input.location?.longitude) {
    throw new HttpsError('invalid-argument', 'type and location are required');
  }
  if (!context.siteId) {
    throw new HttpsError('failed-precondition', 'Membership has no site assignment');
  }

  const now = Date.now();
  const incidentId = db.collection('incidents').doc().id;
  const incident = {
    id: incidentId,
    type: String(input.type) as IncidentType,
    category: String(input.type),
    status: 'open',
    mapStatus: 'unassigned',
    userId: context.userId,
    organizationId: context.organizationId,
    siteId: context.siteId,
    zoneId: null as string | null,
    providerId: context.organizationId,
    location: input.location,
    lastLocation: input.location,
    createdAt: now,
    updatedAt: now,
    assignments: [] as unknown[],
    meta: input.meta || {},
  };

  await db.doc(`incidents/${incidentId}`).set(incident);
  await db.doc(`incidents/${incidentId}/timeline/${db.collection('_').doc().id}`).set({
    eventType: 'incident_created',
    incidentId,
    userId: context.userId,
    organizationId: context.organizationId,
    authProvider: context.authProvider,
    timestamp: now,
  });
  await getRtdb().ref(`incidentTracks/${incidentId}/points`).push({
    lat: input.location.latitude,
    lng: input.location.longitude,
    t: now,
    uid: actorUid(context),
    organizationId: context.organizationId,
  });

  return incident;
}

/**
 * List incidents for the resolved organization only.
 * Client-supplied organizationId is ignored.
 */
export async function listTenantIncidents(
  context: RequestContext,
  options?: { status?: string; limit?: number }
) {
  authorize(context, { permission: 'incidents:read-all' });

  const limit = Math.min(Math.max(Number(options?.limit) || 100, 1), 200);
  let query: admin.firestore.Query = db
    .collection('incidents')
    .where('organizationId', '==', context.organizationId);

  if (options?.status) {
    query = query.where('status', '==', options.status);
  }

  const list = await query.orderBy('createdAt', 'desc').limit(limit).get();

  return {
    organizationId: context.organizationId,
    authProvider: context.authProvider,
    incidents: list.docs.map(d => d.data()),
  };
}

export async function registerTenantPushToken(
  context: RequestContext,
  input: { deviceId: string; token: string; environment?: string }
) {
  if (!input.deviceId || !input.token) {
    throw new HttpsError('invalid-argument', 'deviceId and token required');
  }

  const now = Date.now();
  const environment = input.environment
    ? String(input.environment)
    : process.env.FUNCTIONS_EMULATOR
      ? 'emulator'
      : 'production';
  const devicePayload = {
    token: String(input.token),
    userId: context.userId,
    organizationId: context.organizationId,
    authProvider: context.authProvider,
    installationId: String(input.deviceId),
    environment,
    updatedAt: now,
  };

  await db.doc(`fcmTokens/${actorUid(context)}/devices/${String(input.deviceId)}`).set(devicePayload, {
    merge: true,
  });

  await db
    .doc(`orgDevices/${context.organizationId}/tokens/${actorUid(context)}_${String(input.deviceId)}`)
    .set(
      {
        ...devicePayload,
        deviceId: String(input.deviceId),
      },
      { merge: true }
    );

  return { ok: true as const, organizationId: context.organizationId, environment };
}
