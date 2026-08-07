"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.incidentAccessGrantId = incidentAccessGrantId;
exports.loadIncidentAccessGrant = loadIncidentAccessGrant;
exports.requireActiveIncidentAccessGrant = requireActiveIncidentAccessGrant;
const https_1 = require("firebase-functions/v2/https");
const firebaseApps_1 = require("../firebaseApps");
const collections_1 = require("./collections");
const accessGrants_1 = require("./accessGrants");
const db = (0, firebaseApps_1.getDb)();
function incidentAccessGrantId(incidentId, personId) {
    return `iag_${incidentId}_${personId}`;
}
async function loadIncidentAccessGrant(incidentId, personId) {
    const id = incidentAccessGrantId(incidentId, personId);
    const snap = await db.doc(`${collections_1.COLLECTIONS.incidentAccessGrants}/${id}`).get();
    if (!snap.exists)
        return null;
    return snap.data();
}
async function requireActiveIncidentAccessGrant(input) {
    const grant = await loadIncidentAccessGrant(input.incidentId, input.personId);
    if (!grant || !(0, accessGrants_1.isIncidentAccessGrantActive)(grant)) {
        throw new https_1.HttpsError('permission-denied', 'No active incident access grant. Membership may be revoked and no emergency grant applies.');
    }
    if (input.organizationId &&
        grant.granteeOrganisationId !== input.organizationId) {
        throw new https_1.HttpsError('permission-denied', 'Incident access grant tenant mismatch');
    }
    if (!(0, accessGrants_1.grantAllowsPermission)(grant, input.permission)) {
        throw new https_1.HttpsError('permission-denied', `Incident access grant missing permission: ${input.permission}`);
    }
    return grant;
}
