"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveResponderUnitForContext = resolveResponderUnitForContext;
exports.assignmentMatchesUnit = assignmentMatchesUnit;
/**
 * Resolve the Firestore responderUnits document for a request context.
 * Membership stores unitCode (e.g. ALPHA-12); provisioned docs use ids like unit_lab_alpha_12.
 */
const https_1 = require("firebase-functions/v2/https");
const firebaseApps_1 = require("../firebaseApps");
const db = (0, firebaseApps_1.getDb)();
async function resolveResponderUnitForContext(context) {
    const unitCode = String(context.unitId || '').trim();
    if (!unitCode) {
        throw new https_1.HttpsError('failed-precondition', 'No responder unit bound to membership');
    }
    // Prefer lookup by unitCode within tenant (platform provision path)
    const byCode = await db
        .collection('responderUnits')
        .where('organizationId', '==', context.organizationId)
        .where('unitCode', '==', unitCode)
        .limit(1)
        .get();
    if (!byCode.empty) {
        const doc = byCode.docs[0];
        const data = doc.data();
        return {
            docId: doc.id,
            unitCode: String(data.unitCode || unitCode),
            responderType: data.responderType,
            capabilities: data.capabilities,
            active: data.active,
        };
    }
    // Fallback: document id equals unitCode / legacy unit id
    const byId = await db.doc(`responderUnits/${unitCode}`).get();
    if (byId.exists) {
        const data = byId.data();
        const org = data.organizationId ? String(data.organizationId) : '';
        if (org && org !== context.organizationId) {
            throw new https_1.HttpsError('permission-denied', 'Responder unit not in organisation');
        }
        return {
            docId: byId.id,
            unitCode: String(data.unitCode || unitCode),
            responderType: data.responderType,
            capabilities: data.capabilities,
            active: data.active,
        };
    }
    throw new https_1.HttpsError('failed-precondition', `Responder unit not found for code ${unitCode}`);
}
/** Match an assignment row to this unit (doc id or unit code). */
function assignmentMatchesUnit(assignment, unit) {
    const rid = String(assignment.responderUnitId || assignment.responderId || '');
    const code = String(assignment.unitCode || '');
    return (rid === unit.docId ||
        rid === unit.unitCode ||
        code === unit.unitCode ||
        code === unit.docId);
}
