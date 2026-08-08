"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveFromFirebaseLegacy = resolveFromFirebaseLegacy;
exports.rejectFirebaseOnPlatform = rejectFirebaseOnPlatform;
exports.isFirebaseAuthFallbackEnabled = isFirebaseAuthFallbackEnabled;
const https_1 = require("firebase-functions/v2/https");
const IdentityLinkService_1 = require("../services/IdentityLinkService");
const membershipLoader_1 = require("./membershipLoader");
/**
 * Explicit legacy adapter: Firebase ID token → same RequestContext pipeline.
 * Claims may hint organizationId / unitId but are NEVER sole authority for
 * membership status or permissions.
 */
async function resolveFromFirebaseLegacy(auth, options) {
    const link = await IdentityLinkService_1.IdentityLinkService.resolveByFirebaseUid(auth.uid);
    const claimOrg = typeof auth.token.organizationId === 'string' && auth.token.organizationId
        ? String(auth.token.organizationId)
        : undefined;
    const organizationIdHint = options?.organizationIdHint || claimOrg;
    const membership = await (0, membershipLoader_1.loadActiveMembershipForUser)({
        userId: link.userId,
        organizationIdHint,
    });
    // Platform operators must authenticate via Clerk — never elevate from Firebase claims alone.
    const isPlatformOperator = false;
    const unitIdFromProfile = membership.data.responderProfile &&
        typeof membership.data.responderProfile.unitCode === 'string'
        ? membership.data.responderProfile.unitCode
        : undefined;
    return {
        authUserId: link.userId,
        userId: link.userId,
        organizationId: membership.data.organizationId,
        clerkOrganizationId: membership.data.clerkOrganizationId,
        membershipId: membership.id,
        siteId: membership.data.siteId || '',
        zoneIds: membership.data.zoneIds,
        role: membership.data.kind,
        clerkRole: membership.data.clerkRole,
        permissions: membership.data.permissions || [],
        isPlatformOperator,
        authProvider: 'firebase',
        firebaseUid: auth.uid,
        unitId: unitIdFromProfile ||
            (typeof auth.token.unitId === 'string' ? String(auth.token.unitId) : undefined),
    };
}
/** Reject Firebase auth for platform-only surfaces. */
function rejectFirebaseOnPlatform(authProvider) {
    if (authProvider === 'firebase') {
        throw new https_1.HttpsError('permission-denied', 'Firebase authentication fallback is not allowed on platform routes. Use Clerk.');
    }
}
function isFirebaseAuthFallbackEnabled() {
    const raw = process.env.ALLOW_FIREBASE_AUTH_FALLBACK;
    if (raw === undefined || raw === '')
        return true; // default on during Phase 2B
    return raw === 'true' || raw === '1' || raw === 'yes';
}
