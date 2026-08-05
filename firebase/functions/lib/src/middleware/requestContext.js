"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRequestContext = resolveRequestContext;
exports.resolveRequestContextFromCallable = resolveRequestContextFromCallable;
exports.buildRequestContext = buildRequestContext;
exports.authorize = authorize;
exports.authorizeAnyPermission = authorizeAnyPermission;
exports.requireTenantMatch = requireTenantMatch;
exports.requireAuth = requireAuth;
const clerk_sdk_node_1 = require("@clerk/clerk-sdk-node");
const https_1 = require("firebase-functions/v2/https");
const membershipLoader_1 = require("./membershipLoader");
const firebaseLegacyAdapter_1 = require("./firebaseLegacyAdapter");
// Clerk SDK typings lag runtime methods used by Phase 2 (verifyToken options, org APIs).
const clerk = (0, clerk_sdk_node_1.Clerk)({ secretKey: process.env.CLERK_SECRET_KEY });
function extractBearer(authorizationHeader) {
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
        return null;
    }
    return authorizationHeader.substring(7);
}
async function buildFromClerkToken(token) {
    let session;
    try {
        session = (await clerk.verifyToken(token, {
            authorizedParties: process.env.CLERK_PUBLISHABLE_KEY
                ? [process.env.CLERK_PUBLISHABLE_KEY]
                : undefined,
        }));
    }
    catch (err) {
        console.error('Clerk token verification failed:', err);
        throw new https_1.HttpsError('unauthenticated', 'Invalid Clerk session token');
    }
    const userId = session.sub;
    const orgId = session.org_id;
    const orgRole = session.org_role;
    if (!orgId || !orgRole) {
        throw new https_1.HttpsError('failed-precondition', 'User must belong to an organization. Please select an organization.');
    }
    let organization;
    try {
        organization = await clerk.organizations.getOrganization({
            organizationId: orgId,
        });
    }
    catch (err) {
        console.error('Failed to fetch organization:', err);
        throw new https_1.HttpsError('internal', 'Failed to fetch organization details');
    }
    const organizationId = String(organization.slug || organization.id);
    if (!organizationId) {
        throw new https_1.HttpsError('internal', 'Organization is missing slug/id');
    }
    const membership = await (0, membershipLoader_1.loadActiveMembershipForUser)({
        userId,
        organizationId,
    });
    let isPlatformOperator = false;
    try {
        const user = await clerk.users.getUser(userId);
        isPlatformOperator = user.publicMetadata?.platformAdmin === true;
    }
    catch (err) {
        console.error('Failed to fetch user metadata:', err);
    }
    const unitIdFromProfile = membership.data.responderProfile &&
        typeof membership.data.responderProfile.unitCode === 'string'
        ? membership.data.responderProfile.unitCode
        : undefined;
    return {
        authUserId: userId,
        userId,
        organizationId,
        clerkOrganizationId: orgId,
        membershipId: membership.id,
        siteId: membership.data.siteId || '',
        zoneIds: membership.data.zoneIds,
        role: membership.data.kind,
        clerkRole: orgRole,
        permissions: membership.data.permissions || [],
        isPlatformOperator,
        authProvider: 'clerk',
        unitId: unitIdFromProfile,
    };
}
/**
 * Try Clerk JWT first; optionally fall back to Firebase legacy adapter.
 */
async function resolveRequestContext(source) {
    const bearer = extractBearer(source.authorizationHeader);
    const clerkToken = source.clerkToken || bearer;
    if (clerkToken) {
        try {
            return await buildFromClerkToken(clerkToken);
        }
        catch (err) {
            // If token was explicitly a Clerk token from data, don't fall through on auth errors
            // that are membership/org failures — those should surface.
            if (err instanceof https_1.HttpsError) {
                const code = err.code;
                if (code === 'failed-precondition' ||
                    code === 'permission-denied' ||
                    code === 'internal') {
                    throw err;
                }
            }
            // Invalid Clerk token → try Firebase fallback if enabled
            console.warn('Clerk auth attempt failed, evaluating Firebase fallback');
        }
    }
    if (source.disallowFirebaseFallback) {
        throw new https_1.HttpsError('unauthenticated', 'Clerk authentication required. Firebase fallback is not allowed on this surface.');
    }
    if (!(0, firebaseLegacyAdapter_1.isFirebaseAuthFallbackEnabled)()) {
        throw new https_1.HttpsError('unauthenticated', 'Firebase authentication fallback is disabled. Authenticate with Clerk.');
    }
    if (!source.firebaseAuth?.uid) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    return (0, firebaseLegacyAdapter_1.resolveFromFirebaseLegacy)(source.firebaseAuth);
}
/**
 * Convenience for Firebase callable handlers on the Phase 2B migrated surface.
 */
async function resolveRequestContextFromCallable(req, options) {
    const authorizationHeader = typeof req.rawRequest?.headers?.authorization === 'string'
        ? req.rawRequest.headers.authorization
        : undefined;
    const clerkToken = typeof req.data?.clerkToken === 'string'
        ? req.data.clerkToken
        : typeof req.data?.sessionToken === 'string'
            ? req.data.sessionToken
            : undefined;
    return resolveRequestContext({
        authorizationHeader,
        clerkToken,
        firebaseAuth: req.auth
            ? { uid: req.auth.uid, token: (req.auth.token || {}) }
            : null,
        disallowFirebaseFallback: options?.disallowFirebaseFallback,
    });
}
/**
 * @deprecated Prefer resolveRequestContext / resolveRequestContextFromCallable.
 * Kept for compatibility with earlier Phase 2 scaffolding.
 */
async function buildRequestContext(authorizationHeader) {
    return resolveRequestContext({ authorizationHeader, disallowFirebaseFallback: true });
}
function authorize(context, options) {
    if (context.isPlatformOperator) {
        return;
    }
    if ('permission' in options) {
        if (!context.permissions.includes(options.permission)) {
            throw new https_1.HttpsError('permission-denied', `Missing required permission: ${options.permission}`);
        }
    }
    if ('role' in options) {
        if (context.role !== options.role) {
            throw new https_1.HttpsError('permission-denied', `Missing required role: ${options.role}`);
        }
    }
}
function authorizeAnyPermission(context, permissions) {
    if (context.isPlatformOperator)
        return;
    if (permissions.some(p => context.permissions.includes(p)))
        return;
    throw new https_1.HttpsError('permission-denied', `Missing required permission (one of: ${permissions.join(', ')})`);
}
function requireTenantMatch(context, resourceOrganizationId) {
    if (!resourceOrganizationId || resourceOrganizationId !== context.organizationId) {
        throw new https_1.HttpsError('permission-denied', 'Cross-tenant access denied');
    }
}
function requireAuth(authorizationHeader) {
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
}
