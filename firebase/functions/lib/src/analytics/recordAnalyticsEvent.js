"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordAnalyticsEvent = recordAnalyticsEvent;
const firebaseApps_1 = require("../firebaseApps");
const collections_1 = require("../services/collections");
const db = (0, firebaseApps_1.getDb)();
/**
 * Append-only analytics event capture. Failures are logged but never throw —
 * metrics must not break operational write paths.
 */
async function recordAnalyticsEvent(input) {
    try {
        const ref = db.collection(collections_1.COLLECTIONS.analyticsEvents).doc();
        await ref.set({
            id: ref.id,
            organizationId: input.organizationId,
            siteId: input.siteId ?? null,
            zoneId: input.zoneId ?? null,
            kind: input.kind,
            category: input.category ?? null,
            teamId: input.teamId ?? null,
            resourceType: input.resourceType,
            resourceId: input.resourceId,
            durationMs: input.durationMs ?? null,
            metadata: input.metadata || {},
            createdAt: Date.now(),
        });
    }
    catch (err) {
        console.error('recordAnalyticsEvent failed', err);
    }
}
