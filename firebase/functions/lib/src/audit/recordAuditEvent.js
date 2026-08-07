"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordAuditEvent = recordAuditEvent;
const firebaseApps_1 = require("../firebaseApps");
const collections_1 = require("../services/collections");
const db = (0, firebaseApps_1.getDb)();
/**
 * Append-only audit event. Failures are logged but do not throw —
 * audit must not break operational write paths.
 */
async function recordAuditEvent(input) {
    try {
        const ref = db.collection(collections_1.COLLECTIONS.auditEvents).doc();
        await ref.set({
            id: ref.id,
            organizationId: input.organizationId ?? null,
            siteId: input.siteId ?? null,
            actorUserId: input.actorUserId,
            actorPersonId: input.actorPersonId ?? input.actorUserId,
            action: input.action,
            resourceType: input.resourceType,
            resourceId: input.resourceId,
            timestamp: Date.now(),
            previousState: input.previousState ?? null,
            newState: input.newState ?? null,
            reason: input.reason ?? null,
            accessGrantId: input.accessGrantId ?? null,
            metadata: input.metadata || {},
        });
    }
    catch (err) {
        console.error('recordAuditEvent failed', err);
    }
}
