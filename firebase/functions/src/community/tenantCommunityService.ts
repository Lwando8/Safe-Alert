import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';
import type { RequestContext } from '../middleware/requestContext';
import { authorize, authorizeAnyPermission, requireTenantMatch } from '../middleware/requestContext';
import { assertModuleEnabled } from '../services/moduleGate';
import { COLLECTIONS } from '../services/collections';
import { getDb } from '../firebaseApps';
import { recordAnalyticsEvent } from '../analytics/recordAnalyticsEvent';
import { notifyOrgEvent } from '../notifications/orgNotifications';
import { sanitizeCommunityAlertPublic, sanitizeSightingPublic } from './privacy';

const db = getDb();

const ALERT_TYPES = new Set([
  'MISSING_PET',
  'FOUND_PET',
  'LOST_PROPERTY',
  'FOUND_PROPERTY',
  'COMMUNITY_ASSISTANCE',
  'NOTICE',
]);

export async function createCommunityGroup(
  context: RequestContext,
  input: {
    name: string;
    description?: string;
    category?: string;
    visibility?: 'members' | 'organization';
    siteId?: string | null;
  }
) {
  authorize(context, { permission: 'groups:manage' });
  await assertModuleEnabled(context.organizationId, 'GROUPS');
  await assertModuleEnabled(context.organizationId, 'COMMUNITY');

  if (!input.name) throw new HttpsError('invalid-argument', 'name is required');

  const now = Date.now();
  const ref = db.collection(COLLECTIONS.communityGroups).doc();
  const group = {
    id: ref.id,
    organizationId: context.organizationId,
    siteId: input.siteId ?? context.siteId ?? null,
    zoneId: null,
    name: String(input.name).slice(0, 120),
    description: input.description ? String(input.description).slice(0, 2000) : '',
    category: input.category || 'general',
    visibility: input.visibility === 'members' ? 'members' : 'organization',
    status: 'active' as const,
    organiserUserIds: [context.userId],
    memberUserIds: [context.userId],
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(group);
  return group;
}

export async function listCommunityGroups(context: RequestContext, options?: { limit?: number }) {
  authorize(context, { permission: 'groups:read' });
  await assertModuleEnabled(context.organizationId, 'GROUPS');
  await assertModuleEnabled(context.organizationId, 'COMMUNITY');

  const limit = Math.min(Math.max(Number(options?.limit) || 100, 1), 200);
  const list = await db
    .collection(COLLECTIONS.communityGroups)
    .where('organizationId', '==', context.organizationId)
    .where('status', '==', 'active')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return {
    organizationId: context.organizationId,
    groups: list.docs.map(d => d.data()),
  };
}

export async function joinCommunityGroup(context: RequestContext, groupId: string) {
  authorize(context, { permission: 'groups:join' });
  await assertModuleEnabled(context.organizationId, 'GROUPS');

  const ref = db.doc(`${COLLECTIONS.communityGroups}/${groupId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Group not found');
  const data = snap.data() as Record<string, unknown>;
  requireTenantMatch(context, data.organizationId as string | undefined);

  const members = Array.isArray(data.memberUserIds) ? [...(data.memberUserIds as string[])] : [];
  if (!members.includes(context.userId)) members.push(context.userId);
  await ref.set({ memberUserIds: members, updatedAt: Date.now() }, { merge: true });
  return { id: groupId, memberUserIds: members };
}

export async function createCommunityEvent(
  context: RequestContext,
  input: {
    title: string;
    description?: string;
    startsAt: number;
    endsAt?: number | null;
    locationLabel?: string | null;
    location?: { latitude: number; longitude: number } | null;
    groupId?: string | null;
    siteId?: string | null;
  }
) {
  authorize(context, { permission: 'events:manage' });
  await assertModuleEnabled(context.organizationId, 'EVENTS');
  await assertModuleEnabled(context.organizationId, 'COMMUNITY');

  if (!input.title || !input.startsAt) {
    throw new HttpsError('invalid-argument', 'title and startsAt are required');
  }

  if (input.groupId) {
    const groupSnap = await db.doc(`${COLLECTIONS.communityGroups}/${input.groupId}`).get();
    if (!groupSnap.exists) throw new HttpsError('not-found', 'Group not found');
    requireTenantMatch(context, groupSnap.data()?.organizationId as string | undefined);
  }

  const now = Date.now();
  const ref = db.collection(COLLECTIONS.communityEvents).doc();
  const event = {
    id: ref.id,
    organizationId: context.organizationId,
    siteId: input.siteId ?? context.siteId ?? null,
    groupId: input.groupId ?? null,
    title: String(input.title).slice(0, 200),
    description: input.description ? String(input.description).slice(0, 5000) : '',
    startsAt: Number(input.startsAt),
    endsAt: input.endsAt ?? null,
    locationLabel: input.locationLabel ?? null,
    location: input.location ?? null,
    organiserUserId: context.userId,
    status: 'scheduled' as const,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(event);
  return event;
}

export async function listCommunityEvents(context: RequestContext, options?: { limit?: number }) {
  authorize(context, { permission: 'events:read' });
  await assertModuleEnabled(context.organizationId, 'EVENTS');
  await assertModuleEnabled(context.organizationId, 'COMMUNITY');

  const limit = Math.min(Math.max(Number(options?.limit) || 100, 1), 200);
  const list = await db
    .collection(COLLECTIONS.communityEvents)
    .where('organizationId', '==', context.organizationId)
    .where('status', '==', 'scheduled')
    .orderBy('startsAt', 'asc')
    .limit(limit)
    .get();

  return {
    organizationId: context.organizationId,
    events: list.docs.map(d => d.data()),
  };
}

export async function createCommunityAlert(
  context: RequestContext,
  input: {
    type: string;
    title: string;
    description: string;
    contactMethod?: string | null;
    location?: { latitude: number; longitude: number } | null;
    locationLabel?: string | null;
    attachments?: Array<Record<string, unknown>>;
    details?: Record<string, unknown>;
    siteId?: string | null;
    zoneId?: string | null;
  }
) {
  authorize(context, { permission: 'community:alerts:create' });
  await assertModuleEnabled(context.organizationId, 'COMMUNITY_ALERTS');
  await assertModuleEnabled(context.organizationId, 'COMMUNITY');

  if (!ALERT_TYPES.has(String(input.type))) {
    throw new HttpsError('invalid-argument', 'Invalid alert type');
  }
  if (!input.title || !input.description) {
    throw new HttpsError('invalid-argument', 'title and description are required');
  }

  const now = Date.now();
  const ref = db.collection(COLLECTIONS.communityAlerts).doc();
  const rawDetails = input.details && typeof input.details === 'object' ? input.details : {};
  // Strip private contact fields from details — contactMethod is explicit opt-in only
  const details = sanitizeCommunityAlertPublic({
    type: input.type,
    details: rawDetails,
  }).details;

  const alert = {
    id: ref.id,
    organizationId: context.organizationId,
    siteId: input.siteId ?? context.siteId ?? null,
    zoneId: input.zoneId ?? null,
    type: String(input.type),
    status: 'open' as const,
    title: String(input.title).slice(0, 200),
    description: String(input.description).slice(0, 5000),
    reporterUserId: context.userId,
    contactMethod: input.contactMethod ? String(input.contactMethod).slice(0, 200) : null,
    location: input.location ?? null,
    locationLabel: input.locationLabel ?? null,
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
    details,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  };

  await ref.set(alert);
  await recordAnalyticsEvent({
    organizationId: context.organizationId,
    siteId: alert.siteId,
    kind: 'community_alert_created',
    category: alert.type,
    resourceType: 'communityAlert',
    resourceId: ref.id,
  });
  await notifyOrgEvent({
    organizationId: context.organizationId,
    kind: 'community_alert_created',
    title: 'New community alert',
    body: alert.title,
    data: { alertId: ref.id, type: alert.type },
  });

  return sanitizeCommunityAlertPublic(alert);
}

export async function listCommunityAlerts(
  context: RequestContext,
  options?: { status?: string; type?: string; limit?: number }
) {
  authorize(context, { permission: 'community:alerts:read' });
  await assertModuleEnabled(context.organizationId, 'COMMUNITY_ALERTS');
  await assertModuleEnabled(context.organizationId, 'COMMUNITY');

  const limit = Math.min(Math.max(Number(options?.limit) || 100, 1), 200);
  let query: admin.firestore.Query = db
    .collection(COLLECTIONS.communityAlerts)
    .where('organizationId', '==', context.organizationId);

  if (options?.status) query = query.where('status', '==', options.status);
  if (options?.type) query = query.where('type', '==', options.type);

  const list = await query.orderBy('createdAt', 'desc').limit(limit).get();
  return {
    organizationId: context.organizationId,
    alerts: list.docs.map(d => sanitizeCommunityAlertPublic(d.data() as Record<string, unknown>)),
  };
}

export async function resolveCommunityAlert(
  context: RequestContext,
  input: { alertId: string; note?: string }
) {
  await assertModuleEnabled(context.organizationId, 'COMMUNITY_ALERTS');

  const ref = db.doc(`${COLLECTIONS.communityAlerts}/${input.alertId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Alert not found');
  const data = snap.data() as Record<string, unknown>;
  requireTenantMatch(context, data.organizationId as string | undefined);

  const isOwner = data.reporterUserId === context.userId;
  if (!isOwner) {
    authorize(context, { permission: 'community:alerts:moderate' });
  } else {
    authorizeAnyPermission(context, [
      'community:alerts:create',
      'community:alerts:moderate',
    ]);
  }

  const now = Date.now();
  await ref.set(
    {
      status: 'resolved',
      resolvedAt: now,
      updatedAt: now,
      resolutionNote: input.note ? String(input.note).slice(0, 1000) : null,
    },
    { merge: true }
  );
  await recordAnalyticsEvent({
    organizationId: context.organizationId,
    siteId: (data.siteId as string) || null,
    kind: 'community_alert_resolved',
    category: (data.type as string) || null,
    resourceType: 'communityAlert',
    resourceId: ref.id,
    durationMs: typeof data.createdAt === 'number' ? now - data.createdAt : null,
  });

  return { id: ref.id, status: 'resolved', organizationId: context.organizationId };
}

export async function addAlertSighting(
  context: RequestContext,
  input: {
    alertId: string;
    note: string;
    seenAt?: number;
    location?: { latitude: number; longitude: number } | null;
    locationLabel?: string | null;
    attachments?: Array<Record<string, unknown>>;
  }
) {
  authorize(context, { permission: 'community:alerts:read' });
  await assertModuleEnabled(context.organizationId, 'COMMUNITY_ALERTS');

  if (!input.note) throw new HttpsError('invalid-argument', 'note is required');

  const alertRef = db.doc(`${COLLECTIONS.communityAlerts}/${input.alertId}`);
  const alertSnap = await alertRef.get();
  if (!alertSnap.exists) throw new HttpsError('not-found', 'Alert not found');
  const alert = alertSnap.data() as Record<string, unknown>;
  requireTenantMatch(context, alert.organizationId as string | undefined);

  if (alert.status === 'resolved' || alert.status === 'closed') {
    throw new HttpsError('failed-precondition', 'Alert is no longer open');
  }

  const now = Date.now();
  const sightingRef = alertRef.collection('sightings').doc();
  const raw = {
    id: sightingRef.id,
    organizationId: context.organizationId,
    alertId: alertRef.id,
    reporterUserId: context.userId,
    note: String(input.note).slice(0, 2000),
    seenAt: input.seenAt ? Number(input.seenAt) : now,
    location: input.location ?? null,
    locationLabel: input.locationLabel ?? null,
    attachments: Array.isArray(input.attachments) ? input.attachments : [],
    createdAt: now,
  };
  const sighting = sanitizeSightingPublic(raw);
  await sightingRef.set(sighting);

  await notifyOrgEvent({
    organizationId: context.organizationId,
    kind: 'community_alert_sighting',
    title: 'Sighting reported',
    body: String(alert.title || alertRef.id),
    data: { alertId: alertRef.id, sightingId: sightingRef.id },
    targetUserId: (alert.reporterUserId as string) || undefined,
  });

  return sighting;
}

export async function listAlertSightings(context: RequestContext, alertId: string) {
  authorize(context, { permission: 'community:alerts:read' });
  await assertModuleEnabled(context.organizationId, 'COMMUNITY_ALERTS');

  const alertRef = db.doc(`${COLLECTIONS.communityAlerts}/${alertId}`);
  const alertSnap = await alertRef.get();
  if (!alertSnap.exists) throw new HttpsError('not-found', 'Alert not found');
  requireTenantMatch(context, alertSnap.data()?.organizationId as string | undefined);

  const list = await alertRef.collection('sightings').orderBy('createdAt', 'desc').limit(100).get();
  return {
    organizationId: context.organizationId,
    alertId,
    sightings: list.docs.map(d => sanitizeSightingPublic(d.data() as Record<string, unknown>)),
  };
}
