"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveUniversityIncidentContext = resolveUniversityIncidentContext;
/**
 * Resolve callable auth for university incident actions that must survive
 * membership revocation when an IncidentAccessGrant is active.
 *
 * Normal path: full RequestContext via active membership.
 * Grant path: limited context stamped from grant + auth identity only.
 * Express SOS path is unchanged.
 */
const clerk_sdk_node_1 = require("@clerk/clerk-sdk-node");
const https_1 = require("firebase-functions/v2/https");
const requestContext_1 = require("../middleware/requestContext");
const IdentityLinkService_1 = require("./IdentityLinkService");
const incidentAccessGrantService_1 = require("./incidentAccessGrantService");
const firebaseLegacyAdapter_1 = require("../middleware/firebaseLegacyAdapter");
const clerk = (0, clerk_sdk_node_1.Clerk)({ secretKey: process.env.CLERK_SECRET_KEY });
async function resolveAuthPersonId(req) {
    const authorizationHeader = typeof req.rawRequest?.headers?.authorization === 'string'
        ? req.rawRequest.headers.authorization
        : undefined;
    const clerkToken = typeof req.data?.clerkToken === 'string'
        ? req.data.clerkToken
        : typeof req.data?.sessionToken === 'string'
            ? req.data.sessionToken
            : authorizationHeader?.startsWith('Bearer ')
                ? authorizationHeader.substring(7)
                : undefined;
    if (clerkToken) {
        try {
            const session = (await clerk.verifyToken(clerkToken, {
                authorizedParties: process.env.CLERK_PUBLISHABLE_KEY
                    ? [process.env.CLERK_PUBLISHABLE_KEY]
                    : undefined,
            }));
            if (session?.sub) {
                return { personId: session.sub, authProvider: 'clerk' };
            }
        }
        catch {
            // fall through
        }
    }
    if (req.auth?.uid && (0, firebaseLegacyAdapter_1.isFirebaseAuthFallbackEnabled)()) {
        try {
            const link = await IdentityLinkService_1.IdentityLinkService.resolveByFirebaseUid(req.auth.uid);
            return {
                personId: link.userId,
                authProvider: 'firebase',
                firebaseUid: req.auth.uid,
            };
        }
        catch {
            return {
                personId: req.auth.uid,
                authProvider: 'firebase',
                firebaseUid: req.auth.uid,
            };
        }
    }
    throw new https_1.HttpsError('unauthenticated', 'Authentication required');
}
function contextFromGrant(input) {
    const perms = [];
    if (input.grant.permissions.includes('incident:read')) {
        perms.push('incidents:read-all', 'incidents:read-own');
    }
    if (input.grant.permissions.includes('incident:update')) {
        perms.push('incidents:update', 'incidents:acknowledge');
    }
    if (input.grant.permissions.includes('incident:location')) {
        perms.push('incidents:update');
    }
    return {
        authUserId: input.personId,
        userId: input.personId,
        organizationId: input.grant.granteeOrganisationId,
        clerkOrganizationId: input.grant.granteeOrganisationId,
        membershipId: input.grant.sourceMembershipId || `grant:${input.grant.id}`,
        siteId: '',
        role: 'security_guard',
        clerkRole: 'org:responder',
        permissions: Array.from(new Set(perms)),
        isPlatformOperator: false,
        authProvider: input.authProvider,
        firebaseUid: input.firebaseUid,
        unitId: input.grant.granteeResponderId || undefined,
    };
}
/**
 * Prefer active membership context; fall back to incident access grant.
 */
async function resolveUniversityIncidentContext(req, incidentId, permission) {
    try {
        const context = await (0, requestContext_1.resolveRequestContextFromCallable)(req);
        // Still load grant for authorizeAction options when present
        const grant = await (0, incidentAccessGrantService_1.loadIncidentAccessGrant)(incidentId, context.userId);
        if (grant) {
            // Validate grant is not for another org than context
            if (grant.granteeOrganisationId !== context.organizationId) {
                // Ignore mismatched grant; membership path remains authoritative
                return { context, viaGrant: false };
            }
        }
        return { context, viaGrant: false };
    }
    catch (err) {
        if (!(err instanceof https_1.HttpsError))
            throw err;
        // Only fall back for membership / org precondition failures
        if (err.code !== 'failed-precondition' && err.code !== 'permission-denied') {
            throw err;
        }
        const identity = await resolveAuthPersonId(req);
        const grant = await (0, incidentAccessGrantService_1.requireActiveIncidentAccessGrant)({
            incidentId,
            personId: identity.personId,
            permission,
        });
        return {
            context: contextFromGrant({
                personId: identity.personId,
                authProvider: identity.authProvider,
                firebaseUid: identity.firebaseUid,
                grant,
            }),
            viaGrant: true,
        };
    }
}
