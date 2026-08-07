"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCommunityGroup = createCommunityGroup;
exports.listCommunityGroups = listCommunityGroups;
exports.joinCommunityGroup = joinCommunityGroup;
exports.createCommunityEvent = createCommunityEvent;
exports.listCommunityEvents = listCommunityEvents;
exports.createCommunityAlert = createCommunityAlert;
exports.listCommunityAlerts = listCommunityAlerts;
exports.resolveCommunityAlert = resolveCommunityAlert;
exports.addAlertSighting = addAlertSighting;
exports.listAlertSightings = listAlertSightings;
const https_1 = require("firebase-functions/v2/https");
const requestContext_1 = require("../middleware/requestContext");
const moduleGate_1 = require("../services/moduleGate");
const collections_1 = require("../services/collections");
const firebaseApps_1 = require("../firebaseApps");
const recordAnalyticsEvent_1 = require("../analytics/recordAnalyticsEvent");
const orgNotifications_1 = require("../notifications/orgNotifications");
const privacy_1 = require("./privacy");
const db = (0, firebaseApps_1.getDb)();
const ALERT_TYPES = new Set([
    'MISSING_PET',
    'FOUND_PET',
    'LOST_PROPERTY',
    'FOUND_PROPERTY',
    'COMMUNITY_ASSISTANCE',
    'NOTICE',
]);
async function createCommunityGroup(context, input) {
    (0, requestContext_1.authorize)(context, { permission: 'groups:manage' });
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'GROUPS');
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'COMMUNITY');
    if (!input.name)
        throw new https_1.HttpsError('invalid-argument', 'name is required');
    const now = Date.now();
    const ref = db.collection(collections_1.COLLECTIONS.communityGroups).doc();
    const group = {
        id: ref.id,
        organizationId: context.organizationId,
        siteId: input.siteId ?? context.siteId ?? null,
        zoneId: null,
        name: String(input.name).slice(0, 120),
        description: input.description ? String(input.description).slice(0, 2000) : '',
        category: input.category || 'general',
        visibility: input.visibility === 'members' ? 'members' : 'organization',
        status: 'active',
        organiserUserIds: [context.userId],
        memberUserIds: [context.userId],
        createdAt: now,
        updatedAt: now,
    };
    await ref.set(group);
    return group;
}
async function listCommunityGroups(context, options) {
    (0, requestContext_1.authorize)(context, { permission: 'groups:read' });
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'GROUPS');
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'COMMUNITY');
    const limit = Math.min(Math.max(Number(options?.limit) || 100, 1), 200);
    const list = await db
        .collection(collections_1.COLLECTIONS.communityGroups)
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
async function joinCommunityGroup(context, groupId) {
    (0, requestContext_1.authorize)(context, { permission: 'groups:join' });
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'GROUPS');
    const ref = db.doc(`${collections_1.COLLECTIONS.communityGroups}/${groupId}`);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Group not found');
    const data = snap.data();
    (0, requestContext_1.requireTenantMatch)(context, data.organizationId);
    const members = Array.isArray(data.memberUserIds) ? [...data.memberUserIds] : [];
    if (!members.includes(context.userId))
        members.push(context.userId);
    await ref.set({ memberUserIds: members, updatedAt: Date.now() }, { merge: true });
    return { id: groupId, memberUserIds: members };
}
async function createCommunityEvent(context, input) {
    (0, requestContext_1.authorize)(context, { permission: 'events:manage' });
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'EVENTS');
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'COMMUNITY');
    if (!input.title || !input.startsAt) {
        throw new https_1.HttpsError('invalid-argument', 'title and startsAt are required');
    }
    if (input.groupId) {
        const groupSnap = await db.doc(`${collections_1.COLLECTIONS.communityGroups}/${input.groupId}`).get();
        if (!groupSnap.exists)
            throw new https_1.HttpsError('not-found', 'Group not found');
        (0, requestContext_1.requireTenantMatch)(context, groupSnap.data()?.organizationId);
    }
    const now = Date.now();
    const ref = db.collection(collections_1.COLLECTIONS.communityEvents).doc();
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
        status: 'scheduled',
        createdAt: now,
        updatedAt: now,
    };
    await ref.set(event);
    return event;
}
async function listCommunityEvents(context, options) {
    (0, requestContext_1.authorize)(context, { permission: 'events:read' });
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'EVENTS');
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'COMMUNITY');
    const limit = Math.min(Math.max(Number(options?.limit) || 100, 1), 200);
    const list = await db
        .collection(collections_1.COLLECTIONS.communityEvents)
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
async function createCommunityAlert(context, input) {
    (0, requestContext_1.authorize)(context, { permission: 'community:alerts:create' });
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'COMMUNITY_ALERTS');
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'COMMUNITY');
    if (!ALERT_TYPES.has(String(input.type))) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid alert type');
    }
    if (!input.title || !input.description) {
        throw new https_1.HttpsError('invalid-argument', 'title and description are required');
    }
    const now = Date.now();
    const ref = db.collection(collections_1.COLLECTIONS.communityAlerts).doc();
    const rawDetails = input.details && typeof input.details === 'object' ? input.details : {};
    // Strip private contact fields from details — contactMethod is explicit opt-in only
    const details = (0, privacy_1.sanitizeCommunityAlertPublic)({
        type: input.type,
        details: rawDetails,
    }).details;
    const alert = {
        id: ref.id,
        organizationId: context.organizationId,
        siteId: input.siteId ?? context.siteId ?? null,
        zoneId: input.zoneId ?? null,
        type: String(input.type),
        status: 'open',
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
    await (0, recordAnalyticsEvent_1.recordAnalyticsEvent)({
        organizationId: context.organizationId,
        siteId: alert.siteId,
        kind: 'community_alert_created',
        category: alert.type,
        resourceType: 'communityAlert',
        resourceId: ref.id,
    });
    await (0, orgNotifications_1.notifyOrgEvent)({
        organizationId: context.organizationId,
        kind: 'community_alert_created',
        title: 'New community alert',
        body: alert.title,
        data: { alertId: ref.id, type: alert.type },
    });
    return (0, privacy_1.sanitizeCommunityAlertPublic)(alert);
}
async function listCommunityAlerts(context, options) {
    (0, requestContext_1.authorize)(context, { permission: 'community:alerts:read' });
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'COMMUNITY_ALERTS');
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'COMMUNITY');
    const limit = Math.min(Math.max(Number(options?.limit) || 100, 1), 200);
    let query = db
        .collection(collections_1.COLLECTIONS.communityAlerts)
        .where('organizationId', '==', context.organizationId);
    if (options?.status)
        query = query.where('status', '==', options.status);
    if (options?.type)
        query = query.where('type', '==', options.type);
    const list = await query.orderBy('createdAt', 'desc').limit(limit).get();
    return {
        organizationId: context.organizationId,
        alerts: list.docs.map(d => (0, privacy_1.sanitizeCommunityAlertPublic)(d.data())),
    };
}
async function resolveCommunityAlert(context, input) {
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'COMMUNITY_ALERTS');
    const ref = db.doc(`${collections_1.COLLECTIONS.communityAlerts}/${input.alertId}`);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Alert not found');
    const data = snap.data();
    (0, requestContext_1.requireTenantMatch)(context, data.organizationId);
    const isOwner = data.reporterUserId === context.userId;
    if (!isOwner) {
        (0, requestContext_1.authorize)(context, { permission: 'community:alerts:moderate' });
    }
    else {
        (0, requestContext_1.authorizeAnyPermission)(context, [
            'community:alerts:create',
            'community:alerts:moderate',
        ]);
    }
    const now = Date.now();
    await ref.set({
        status: 'resolved',
        resolvedAt: now,
        updatedAt: now,
        resolutionNote: input.note ? String(input.note).slice(0, 1000) : null,
    }, { merge: true });
    await (0, recordAnalyticsEvent_1.recordAnalyticsEvent)({
        organizationId: context.organizationId,
        siteId: data.siteId || null,
        kind: 'community_alert_resolved',
        category: data.type || null,
        resourceType: 'communityAlert',
        resourceId: ref.id,
        durationMs: typeof data.createdAt === 'number' ? now - data.createdAt : null,
    });
    return { id: ref.id, status: 'resolved', organizationId: context.organizationId };
}
async function addAlertSighting(context, input) {
    (0, requestContext_1.authorize)(context, { permission: 'community:alerts:read' });
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'COMMUNITY_ALERTS');
    if (!input.note)
        throw new https_1.HttpsError('invalid-argument', 'note is required');
    const alertRef = db.doc(`${collections_1.COLLECTIONS.communityAlerts}/${input.alertId}`);
    const alertSnap = await alertRef.get();
    if (!alertSnap.exists)
        throw new https_1.HttpsError('not-found', 'Alert not found');
    const alert = alertSnap.data();
    (0, requestContext_1.requireTenantMatch)(context, alert.organizationId);
    if (alert.status === 'resolved' || alert.status === 'closed') {
        throw new https_1.HttpsError('failed-precondition', 'Alert is no longer open');
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
    const sighting = (0, privacy_1.sanitizeSightingPublic)(raw);
    await sightingRef.set(sighting);
    await (0, orgNotifications_1.notifyOrgEvent)({
        organizationId: context.organizationId,
        kind: 'community_alert_sighting',
        title: 'Sighting reported',
        body: String(alert.title || alertRef.id),
        data: { alertId: alertRef.id, sightingId: sightingRef.id },
        targetUserId: alert.reporterUserId || undefined,
    });
    return sighting;
}
async function listAlertSightings(context, alertId) {
    (0, requestContext_1.authorize)(context, { permission: 'community:alerts:read' });
    await (0, moduleGate_1.assertModuleEnabled)(context.organizationId, 'COMMUNITY_ALERTS');
    const alertRef = db.doc(`${collections_1.COLLECTIONS.communityAlerts}/${alertId}`);
    const alertSnap = await alertRef.get();
    if (!alertSnap.exists)
        throw new https_1.HttpsError('not-found', 'Alert not found');
    (0, requestContext_1.requireTenantMatch)(context, alertSnap.data()?.organizationId);
    const list = await alertRef.collection('sightings').orderBy('createdAt', 'desc').limit(100).get();
    return {
        organizationId: context.organizationId,
        alertId,
        sightings: list.docs.map(d => (0, privacy_1.sanitizeSightingPublic)(d.data())),
    };
}
