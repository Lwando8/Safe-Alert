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
exports.MembershipSyncService = void 0;
const admin = __importStar(require("firebase-admin"));
const clerk_sdk_node_1 = require("@clerk/clerk-sdk-node");
// Clerk SDK typings lag runtime org membership APIs used here.
const clerk = (0, clerk_sdk_node_1.Clerk)({ secretKey: process.env.CLERK_SECRET_KEY });
const db = admin.firestore();
/**
 * Service for syncing Clerk organization memberships to Firestore
 */
class MembershipSyncService {
    /**
     * Sync a Clerk organization membership to Firestore
     * Creates new membership or updates existing one
     */
    static async syncMembership(clerkMembershipId) {
        console.log('Syncing membership:', clerkMembershipId);
        // Get membership from Clerk
        const clerkMembership = await clerk.organizationMemberships.getOrganizationMembership({
            organizationMembershipId: clerkMembershipId,
        });
        const { organization, publicUserData } = clerkMembership;
        const clerkRole = clerkMembership.role;
        if (!publicUserData?.userId) {
            throw new Error('Membership has no user data');
        }
        // Map Clerk role to our membership kind
        const kind = this.mapRoleToKind(clerkRole);
        // Derive permissions from role
        const permissions = this.derivePermissions(clerkRole, kind);
        // Check if membership already exists
        const existingSnap = await db
            .collection('memberships')
            .where('clerkMembershipId', '==', clerkMembershipId)
            .limit(1)
            .get();
        const orgSlug = String(organization.slug || organization.id);
        const membershipData = {
            clerkMembershipId,
            clerkOrganizationId: organization.id,
            organizationId: orgSlug,
            userId: publicUserData.userId,
            kind,
            status: 'active',
            clerkRole,
            permissions,
            updatedAt: Date.now(),
        };
        if (existingSnap.empty) {
            // Create new membership
            const membershipRef = db.collection('memberships').doc();
            membershipData.id = membershipRef.id;
            membershipData.createdAt = Date.now();
            // Set default site (first site of organization)
            const siteId = await this.getDefaultSiteId(orgSlug);
            if (!siteId) {
                console.warn('No default site found for org:', orgSlug);
                throw new Error('Organization must have at least one site configured');
            }
            membershipData.siteId = siteId;
            await membershipRef.set(membershipData);
            console.log('Created membership:', membershipRef.id);
            return membershipRef.id;
        }
        else {
            // Update existing membership
            const membershipRef = existingSnap.docs[0].ref;
            await membershipRef.update(membershipData);
            console.log('Updated membership:', membershipRef.id);
            return membershipRef.id;
        }
    }
    /**
     * Revoke membership (soft delete)
     */
    static async revokeMembership(clerkMembershipId) {
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
            console.warn('Membership not found for revocation');
        }
    }
    /**
     * Update membership last seen timestamp
     */
    static async updateLastSeen(membershipId) {
        await db.collection('memberships').doc(membershipId).update({
            lastSeenAt: Date.now(),
        });
    }
    /**
     * Map Clerk role to membership kind
     */
    static mapRoleToKind(clerkRole) {
        const roleMap = {
            'org:admin': 'org_admin',
            'org:supervisor': 'control_room',
            'org:responder': 'security_guard',
            'org:staff': 'staff',
            'org:student': 'student',
        };
        return roleMap[clerkRole] || 'student';
    }
    /**
     * Derive permissions from role and kind
     */
    static derivePermissions(clerkRole, kind) {
        const permissionMap = {
            'org:admin': [
                'incidents:create',
                'incidents:read-all',
                'incidents:assign',
                'incidents:update',
                'incidents:close',
                'responders:read',
                'responders:manage',
                'sites:read',
                'sites:manage',
                'memberships:read',
                'memberships:manage',
                'analytics:read',
                'audit:read',
                'organization:manage',
            ],
            'org:supervisor': [
                'incidents:create',
                'incidents:read-all',
                'incidents:assign',
                'incidents:update',
                'incidents:close',
                'responders:read',
                'responders:manage',
                'sites:read',
                'analytics:read',
                'audit:read',
            ],
            'org:responder': [
                'incidents:read-all',
                'incidents:acknowledge',
                'incidents:update',
                'responders:read',
                'sites:read',
            ],
            'org:staff': [
                'incidents:create',
                'incidents:read-own',
                'sites:read',
            ],
            'org:student': [
                'incidents:create',
                'incidents:read-own',
                'sites:read',
            ],
        };
        return permissionMap[clerkRole] || ['incidents:create', 'incidents:read-own'];
    }
    /**
     * Get default site ID for organization
     */
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
    /**
     * Ensure organization + default site exist (for webhook organization.created / bootstrap).
     */
    static async ensureOrganizationAndDefaultSite(params) {
        const { clerkOrganizationId, organizationId, name } = params;
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
    /**
     * Bulk sync all members of an organization
     */
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
