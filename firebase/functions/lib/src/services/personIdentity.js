"use strict";
/**
 * Person-first identity seam.
 *
 * Compatibility rule (Phase B):
 *   personId === Clerk userId for existing records.
 * Do NOT re-key memberships / incidents / requests.
 * identityLinks remain the live Clerk↔Firebase store; IdentityAccount is the domain view.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.personIdFromClerkUserId = personIdFromClerkUserId;
exports.clerkUserIdFromPersonId = clerkUserIdFromPersonId;
exports.clerkIdentityAccountId = clerkIdentityAccountId;
exports.firebaseIdentityAccountId = firebaseIdentityAccountId;
exports.identityAccountsFromLink = identityAccountsFromLink;
exports.buildPersonRecord = buildPersonRecord;
/**
 * Compat: existing Clerk user ids are Seren person ids until a future migration.
 */
function personIdFromClerkUserId(clerkUserId) {
    if (!clerkUserId)
        throw new Error('clerkUserId required');
    return clerkUserId;
}
function clerkUserIdFromPersonId(personId) {
    return personId;
}
/** Deterministic identityAccount id for Clerk subject. */
function clerkIdentityAccountId(clerkUserId) {
    return `clerk:${clerkUserId}`;
}
/** Deterministic identityAccount id for Firebase uid. */
function firebaseIdentityAccountId(firebaseUid) {
    return `firebase:${firebaseUid}`;
}
/**
 * Adapt an identityLinks document into IdentityAccount views (Clerk + Firebase sides).
 */
function identityAccountsFromLink(link) {
    const personId = personIdFromClerkUserId(link.userId || link.clerkUserId);
    const status = link.status === 'revoked' ? 'revoked' : 'active';
    const createdAt = link.createdAt || Date.now();
    const updatedAt = link.updatedAt;
    return [
        {
            identityAccountId: clerkIdentityAccountId(link.clerkUserId),
            personId,
            provider: 'CLERK',
            providerSubjectId: link.clerkUserId,
            status,
            createdAt,
            updatedAt,
        },
        {
            identityAccountId: firebaseIdentityAccountId(link.firebaseUid),
            personId,
            provider: 'FIREBASE',
            providerSubjectId: link.firebaseUid,
            status,
            createdAt,
            updatedAt,
        },
    ];
}
function buildPersonRecord(personId, partial) {
    const now = Date.now();
    return {
        personId,
        status: partial?.status || 'active',
        displayName: partial?.displayName ?? null,
        createdAt: partial?.createdAt || now,
        updatedAt: partial?.updatedAt || now,
    };
}
