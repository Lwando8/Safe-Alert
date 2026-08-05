import * as admin from 'firebase-admin';
import { Clerk } from '@clerk/clerk-sdk-node';

const clerk = Clerk({ secretKey: process.env.CLERK_SECRET_KEY });
const db = admin.firestore();

/**
 * Firestore membership schema
 */
interface Membership {
  id: string;
  clerkMembershipId: string;
  clerkOrganizationId: string;
  organizationId: string;        // Org slug (internal ID)
  userId: string;                 // Clerk user ID
  siteId: string;                 // Primary site
  zoneIds?: string[];             // Zone assignments
  kind: MembershipKind;
  status: MembershipStatus;
  clerkRole: string;
  permissions: string[];
  responderProfile?: ResponderProfile;
  createdAt: number;
  updatedAt: number;
  lastSeenAt?: number;
}

type MembershipKind =
  | 'student'
  | 'staff'
  | 'contractor'
  | 'security_guard'
  | 'control_room'
  | 'org_admin';

type MembershipStatus = 'invited' | 'active' | 'suspended' | 'revoked';

interface ResponderProfile {
  unitCode?: string;
  responderType?: string;
  approvalStatus?: 'pending' | 'approved' | 'rejected' | 'revoked';
  employmentStatus?: 'active' | 'inactive';
  deviceBindingRequired?: boolean;
}

/**
 * Service for syncing Clerk organization memberships to Firestore
 */
export class MembershipSyncService {
  /**
   * Sync a Clerk organization membership to Firestore
   * Creates new membership or updates existing one
   */
  static async syncMembership(clerkMembershipId: string): Promise<string> {
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
    
    const membershipData: Partial<Membership> = {
      clerkMembershipId,
      clerkOrganizationId: organization.id,
      organizationId: organization.slug,
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
      const siteId = await this.getDefaultSiteId(organization.slug);
      if (!siteId) {
        console.warn('No default site found for org:', organization.slug);
        throw new Error('Organization must have at least one site configured');
      }
      membershipData.siteId = siteId;
      
      await membershipRef.set(membershipData);
      console.log('Created membership:', membershipRef.id);
      return membershipRef.id;
    } else {
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
  static async revokeMembership(clerkMembershipId: string): Promise<void> {
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
    } else {
      console.warn('Membership not found for revocation');
    }
  }
  
  /**
   * Update membership last seen timestamp
   */
  static async updateLastSeen(membershipId: string): Promise<void> {
    await db.collection('memberships').doc(membershipId).update({
      lastSeenAt: Date.now(),
    });
  }
  
  /**
   * Map Clerk role to membership kind
   */
  private static mapRoleToKind(clerkRole: string): MembershipKind {
    const roleMap: Record<string, MembershipKind> = {
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
  private static derivePermissions(clerkRole: string, kind: MembershipKind): string[] {
    const permissionMap: Record<string, string[]> = {
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
  private static async getDefaultSiteId(organizationId: string): Promise<string | null> {
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
   * Bulk sync all members of an organization
   */
  static async syncOrganizationMembers(clerkOrganizationId: string): Promise<void> {
    console.log('Syncing all members for org:', clerkOrganizationId);
    
    // Get all memberships from Clerk
    const memberships = await clerk.organizations.getOrganizationMembershipList({
      organizationId: clerkOrganizationId,
      limit: 500,
    });
    
    let syncCount = 0;
    for (const membership of memberships.data) {
      try {
        await this.syncMembership(membership.id);
        syncCount++;
      } catch (err) {
        console.error('Failed to sync membership:', membership.id, err);
      }
    }
    
    console.log(`Synced ${syncCount} memberships for org`);
  }
}
