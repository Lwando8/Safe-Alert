"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertMembershipPayload = exports.derivePermissions = exports.mapRoleToKind = exports.MembershipSyncService = void 0;
const admin = __importStar(require("firebase-admin"));
const clerk_sdk_node_1 = require("@clerk/clerk-sdk-node");
const membershipMapping_1 = require("./membershipMapping");
Object.defineProperty(exports, "assertMembershipPayload", { enumerable: true, get: function () { return membershipMapping_1.assertMembershipPayload; } });
Object.defineProperty(exports, "derivePermissions", { enumerable: true, get: function () { return membershipMapping_1.derivePermissions; } });
Object.defineProperty(exports, "mapRoleToKind", { enumerable: true, get: function () { return membershipMapping_1.mapRoleToKind; } });
// Clerk SDK typings lag runtime org membership APIs used here.
const clerk = (0, clerk_sdk_node_1.Clerk)({ secretKey: process.env.CLERK_SECRET_KEY });
const db = admin.firestore();
/**
 * Service for syncing Clerk organization memberships to Firestore.
 * Failures must not leave partially trusted memberships (no write without site).
 */
class MembershipSyncService {
    static async syncMembership(clerkMembershipId, options) {
        if (!clerkMembershipId) {
            throw new Error('Missing membership id');
        }
        console.log('Syncing membership:', clerkMembershipId);
        const clerkMembership = await clerk.organizationMemberships.getOrganizationMembership({
            organizationMembershipId: clerkMembershipId,
        });
        const { organization, publicUserData } = clerkMembership;
        const clerkRole = clerkMembership.role;
        if (!publicUserData?.userId) {
            throw new Error('Membership has no user data');
        }
        if (!organization?.id) {
            throw new Error('Membership has no organization');
        }
        const kind = (0, membershipMapping_1.mapRoleToKind)(clerkRole);
        const permissions = (0, membershipMapping_1.derivePermissions)(clerkRole, kind);
        const orgSlug = String(organization.slug || organization.id);
        (0, membershipMapping_1.assertMembershipPayload)({
            clerkMembershipId,
            clerkOrganizationId: organization.id,
            organizationId: orgSlug,
            userId: publicUserData.userId,
        });
        const existingSnap = await db
            .collection('memberships')
            .where('clerkMembershipId', '==', clerkMembershipId)
            .limit(1)
            .get();
        const membershipData = {
            clerkMembershipId,
            clerkOrganizationId: organization.id,
            // Preserve tenant id from org slug; never trust client overrides
            organizationId: orgSlug,
            userId: publicUserData.userId,
            kind,
            status: 'active',
            clerkRole,
            permissions,
            updatedAt: Date.now(),
        };
        if (existingSnap.empty) {
            const siteId = await this.getDefaultSiteId(orgSlug);
            if (!siteId) {
                console.warn('No default site found for org:', orgSlug);
                throw new Error('Organization must have at least one site configured');
            }
            const membershipRef = db.collection('memberships').doc();
            membershipData.id = membershipRef.id;
            membershipData.createdAt = Date.now();
            membershipData.siteId = siteId;
            await membershipRef.set(membershipData);
            console.log('Created membership:', membershipRef.id);
            return membershipRef.id;
        }
        const existing = existingSnap.docs[0];
        const existingData = existing.data();
        // Preserve existing siteId and never rewrite organizationId to a different tenant
        if (existingData.organizationId && existingData.organizationId !== orgSlug) {
            throw new Error(`Tenant ID conflict: membership ${clerkMembershipId} maps to ${existingData.organizationId} but Clerk org slug is ${orgSlug}`);
        }
        // created → force active; updated → preserve local suspended/revoked
        const nextStatus = options?.forceActive
            ? 'active'
            : existingData.status === 'suspended' || existingData.status === 'revoked'
                ? existingData.status
                : 'active';
        await existing.ref.update({
            ...membershipData,
            status: nextStatus,
            siteId: existingData.siteId,
            organizationId: existingData.organizationId || orgSlug,
        });
        console.log('Updated membership:', existing.id);
        return existing.id;
    }
    static async revokeMembership(clerkMembershipId) {
        if (!clerkMembershipId) {
            throw new Error('Missing membership id');
        }
        console.log('Revoking membership:', clerkMembershipId);
        const membershipSnap = await db
            .collection('memberships')
            .where('clerkMembershipId', '==', clerkMembershipId)
            .limit(1)
            .get();
        if (!membershipSnap.empty) {
            await membershipSnap.docs[0].ref.update({
                status: 'revoked',
                updatedAt: Date.now(),
            });
            console.log('Membership revoked');
        }
        else {
            // Unknown membership — fail closed without creating a partial record
            console.warn('Membership not found for revocation; no write performed');
        }
    }
    static async suspendMembership(clerkMembershipId) {
        if (!clerkMembershipId) {
            throw new Error('Missing membership id');
        }
        const membershipSnap = await db
            .collection('memberships')
            .where('clerkMembershipId', '==', clerkMembershipId)
            .limit(1)
            .get();
        if (membershipSnap.empty) {
            throw new Error('Membership not found for suspension');
        }
        await membershipSnap.docs[0].ref.update({
            status: 'suspended',
            updatedAt: Date.now(),
        });
    }
    static async updateLastSeen(membershipId) {
        await db.collection('memberships').doc(membershipId).update({
            lastSeenAt: Date.now(),
        });
    }
    static async getDefaultSiteId(organizationId) {
        const sitesSnap = await db
            .collection('sites')
            .where('organizationId', '==', organizationId)
            .where('status', '==', 'active')
            .orderBy('createdAt', 'asc')
            .limit(1)
            .get();
        if (sitesSnap.empty) {
            return null;
        }
        return sitesSnap.docs[0].id;
    }
    static async ensureOrganizationAndDefaultSite(params) {
        const { clerkOrganizationId, organizationId, name } = params;
        if (!clerkOrganizationId || !organizationId) {
            throw new Error('organization id and slug are required');
        }
        const now = Date.now();
        await db.doc(`organizations/${organizationId}`).set({
            id: organizationId,
            clerkOrganizationId,
            name,
            slug: organizationId,
            status: 'active',
            updatedAt: now,
            createdAt: now,
        }, { merge: true });
        const existingSite = await this.getDefaultSiteId(organizationId);
        if (existingSite)
            return existingSite;
        const siteRef = db.collection('sites').doc();
        await siteRef.set({
            id: siteRef.id,
            organizationId,
            name: `${name} Main Campus`,
            slug: 'main',
            status: 'active',
            createdAt: now,
            updatedAt: now,
        });
        return siteRef.id;
    }
    static async syncOrganizationMembers(clerkOrganizationId) {
        console.log('Syncing all members for org:', clerkOrganizationId);
        const organization = await clerk.organizations.getOrganization({
            organizationId: clerkOrganizationId,
        });
        const organizationId = String(organization.slug || organization.id);
        await this.ensureOrganizationAndDefaultSite({
            clerkOrganizationId,
            organizationId,
            name: organization.name || organizationId,
        });
        const membershipsResult = await clerk.organizations.getOrganizationMembershipList({
            organizationId: clerkOrganizationId,
            limit: 500,
        });
        const membershipList = Array.isArray(membershipsResult)
            ? membershipsResult
            : membershipsResult?.data || [];
        let syncCount = 0;
        for (const membership of membershipList) {
            try {
                await this.syncMembership(membership.id);
                syncCount++;
            }
            catch (err) {
                console.error('Failed to sync membership:', membership.id, err);
            }
        }
        console.log(`Synced ${syncCount} memberships for org`);
        return syncCount;
    }
}
exports.MembershipSyncService = MembershipSyncService;
