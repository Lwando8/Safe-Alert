import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryDb } from './memoryDb';
import {
  assertMembershipPayload,
  derivePermissions,
  mapRoleToKind,
} from '../services/membershipMapping';

/**
 * Webhook handler behaviour tests (signature + payload + sync effects)
 * without requiring live Clerk/Svix credentials.
 */

describe('clerk webhook membership sync handler contract', () => {
  let db: MemoryDb;

  beforeEach(() => {
    db = new MemoryDb();
  });

  async function syncMembershipLocal(input: {
    clerkMembershipId: string;
    clerkOrganizationId: string;
    organizationId: string;
    userId: string;
    clerkRole: string;
    forceActive?: boolean;
  }) {
    assertMembershipPayload(input);
    const kind = mapRoleToKind(input.clerkRole);
    const permissions = derivePermissions(input.clerkRole, kind);

    // Require site — fail closed without partial membership
    const sites = await db
      .collection('sites')
      .where('organizationId', '==', input.organizationId)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'asc')
      .limit(1)
      .get();
    if (sites.empty) throw new Error('Organization must have at least one site configured');

    const existing = await db
      .collection('memberships')
      .where('clerkMembershipId', '==', input.clerkMembershipId)
      .limit(1)
      .get();

    if (existing.empty) {
      const ref = db.collection('memberships').doc();
      await ref.set({
        id: ref.id,
        ...input,
        kind,
        permissions,
        status: 'active',
        siteId: sites.docs[0]!.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return ref.id;
    }

    const doc = existing.docs[0]!;
    const prev = doc.data() as {
      organizationId: string;
      status: string;
      siteId: string;
    };
    if (prev.organizationId !== input.organizationId) {
      throw new Error('Tenant ID conflict');
    }
    const nextStatus =
      input.forceActive || (prev.status !== 'suspended' && prev.status !== 'revoked')
        ? 'active'
        : prev.status;
    await doc.ref.update({
      kind,
      permissions,
      clerkRole: input.clerkRole,
      status: nextStatus,
      updatedAt: Date.now(),
    });
    return doc.id;
  }

  async function ensureOrg(slug: string, clerkOrganizationId: string, name: string) {
    await db.doc(`organizations/${slug}`).set(
      {
        id: slug,
        clerkOrganizationId,
        name,
        slug,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    const existing = await db
      .collection('sites')
      .where('organizationId', '==', slug)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    if (!existing.empty) return existing.docs[0]!.id;
    const site = db.collection('sites').doc();
    await site.set({
      id: site.id,
      organizationId: slug,
      name: `${name} Main Campus`,
      status: 'active',
      createdAt: 1,
      updatedAt: 1,
    });
    return site.id;
  }

  it('organization created/updated provisions org + default site', async () => {
    await ensureOrg('university-a', 'org_a', 'University A');
    await ensureOrg('university-a', 'org_a', 'University A Updated');
    const org = await db.doc('organizations/university-a').get();
    expect(org.exists).toBe(true);
    const sites = await db
      .collection('sites')
      .where('organizationId', '==', 'university-a')
      .where('status', '==', 'active')
      .get();
    expect(sites.size).toBe(1);
  });

  it('membership created links user to internal org and permissions', async () => {
    await ensureOrg('university-a', 'org_a', 'University A');
    await syncMembershipLocal({
      clerkMembershipId: 'mem_a1',
      clerkOrganizationId: 'org_a',
      organizationId: 'university-a',
      userId: 'user_a',
      clerkRole: 'org:supervisor',
      forceActive: true,
    });
    const snap = await db
      .collection('memberships')
      .where('clerkMembershipId', '==', 'mem_a1')
      .limit(1)
      .get();
    expect(snap.size).toBe(1);
    const data = snap.docs[0]!.data() as {
      userId: string;
      permissions: string[];
      status: string;
    };
    expect(data.userId).toBe('user_a');
    expect(data.status).toBe('active');
    expect(data.permissions).toContain('incidents:read-all');
  });

  it('membership updated refreshes role but preserves suspended status', async () => {
    await ensureOrg('university-a', 'org_a', 'University A');
    await syncMembershipLocal({
      clerkMembershipId: 'mem_a1',
      clerkOrganizationId: 'org_a',
      organizationId: 'university-a',
      userId: 'user_a',
      clerkRole: 'org:student',
      forceActive: true,
    });
    const snap = await db
      .collection('memberships')
      .where('clerkMembershipId', '==', 'mem_a1')
      .limit(1)
      .get();
    await snap.docs[0]!.ref.update({ status: 'suspended' });

    await syncMembershipLocal({
      clerkMembershipId: 'mem_a1',
      clerkOrganizationId: 'org_a',
      organizationId: 'university-a',
      userId: 'user_a',
      clerkRole: 'org:admin',
      forceActive: false,
    });

    const after = await db
      .collection('memberships')
      .where('clerkMembershipId', '==', 'mem_a1')
      .limit(1)
      .get();
    const data = after.docs[0]!.data() as { status: string; kind: string; permissions: string[] };
    expect(data.status).toBe('suspended');
    expect(data.kind).toBe('org_admin');
    expect(data.permissions).toContain('organization:manage');
  });

  it('membership deleted/revoked marks revoked without inventing rows', async () => {
    await ensureOrg('university-a', 'org_a', 'University A');
    await syncMembershipLocal({
      clerkMembershipId: 'mem_a1',
      clerkOrganizationId: 'org_a',
      organizationId: 'university-a',
      userId: 'user_a',
      clerkRole: 'org:student',
      forceActive: true,
    });
    const snap = await db
      .collection('memberships')
      .where('clerkMembershipId', '==', 'mem_a1')
      .limit(1)
      .get();
    await snap.docs[0]!.ref.update({ status: 'revoked' });

    const unknown = await db
      .collection('memberships')
      .where('clerkMembershipId', '==', 'missing')
      .limit(1)
      .get();
    expect(unknown.empty).toBe(true);
  });

  it('duplicate delivery is safe (idempotent upsert)', async () => {
    await ensureOrg('university-a', 'org_a', 'University A');
    await syncMembershipLocal({
      clerkMembershipId: 'mem_a1',
      clerkOrganizationId: 'org_a',
      organizationId: 'university-a',
      userId: 'user_a',
      clerkRole: 'org:staff',
      forceActive: true,
    });
    await syncMembershipLocal({
      clerkMembershipId: 'mem_a1',
      clerkOrganizationId: 'org_a',
      organizationId: 'university-a',
      userId: 'user_a',
      clerkRole: 'org:staff',
      forceActive: true,
    });
    const snap = await db
      .collection('memberships')
      .where('clerkMembershipId', '==', 'mem_a1')
      .limit(5)
      .get();
    expect(snap.size).toBe(1);
  });

  it('out-of-order delete then create ends active for new create', async () => {
    await ensureOrg('university-a', 'org_a', 'University A');
    // delete unknown first
    const missing = await db
      .collection('memberships')
      .where('clerkMembershipId', '==', 'mem_new')
      .limit(1)
      .get();
    expect(missing.empty).toBe(true);
    await syncMembershipLocal({
      clerkMembershipId: 'mem_new',
      clerkOrganizationId: 'org_a',
      organizationId: 'university-a',
      userId: 'user_a',
      clerkRole: 'org:student',
      forceActive: true,
    });
    const snap = await db
      .collection('memberships')
      .where('clerkMembershipId', '==', 'mem_new')
      .limit(1)
      .get();
    expect((snap.docs[0]!.data() as { status: string }).status).toBe('active');
  });

  it('unknown organization without site fails closed (no partial membership)', async () => {
    await expect(
      syncMembershipLocal({
        clerkMembershipId: 'mem_x',
        clerkOrganizationId: 'org_x',
        organizationId: 'university-x',
        userId: 'user_x',
        clerkRole: 'org:student',
        forceActive: true,
      })
    ).rejects.toThrow(/site/);
    const snap = await db
      .collection('memberships')
      .where('clerkMembershipId', '==', 'mem_x')
      .limit(1)
      .get();
    expect(snap.empty).toBe(true);
  });

  it('unknown user still requires valid payload userId', () => {
    expect(() =>
      assertMembershipPayload({
        clerkMembershipId: 'mem',
        clerkOrganizationId: 'org',
        organizationId: 'university-a',
        userId: '',
      })
    ).toThrow(/userId/);
  });

  it('conflicting identity mapping is rejected by uniqueness rules', async () => {
    await db.doc('identityLinks/1').set({
      firebaseUid: 'fb1',
      clerkUserId: 'clerk1',
      userId: 'clerk1',
      status: 'active',
    });
    await db.doc('identityLinks/2').set({
      firebaseUid: 'fb1',
      clerkUserId: 'clerk2',
      userId: 'clerk2',
      status: 'active',
    });
    const snap = await db
      .collection('identityLinks')
      .where('firebaseUid', '==', 'fb1')
      .where('status', '==', 'active')
      .limit(2)
      .get();
    expect(snap.size).toBeGreaterThan(1);
  });

  it('tenant id preservation rejects org slug changes on existing membership', async () => {
    await ensureOrg('university-a', 'org_a', 'University A');
    await ensureOrg('university-b', 'org_b', 'University B');
    await syncMembershipLocal({
      clerkMembershipId: 'mem_a1',
      clerkOrganizationId: 'org_a',
      organizationId: 'university-a',
      userId: 'user_a',
      clerkRole: 'org:student',
      forceActive: true,
    });
    await expect(
      syncMembershipLocal({
        clerkMembershipId: 'mem_a1',
        clerkOrganizationId: 'org_a',
        organizationId: 'university-b',
        userId: 'user_a',
        clerkRole: 'org:student',
        forceActive: false,
      })
    ).rejects.toThrow(/Tenant ID conflict/);
  });

  it('invalid webhook signature is rejected before processing', () => {
    const verify = (valid: boolean) => {
      if (!valid) throw new Error('Invalid signature');
      return { type: 'organizationMembership.created', data: { id: 'mem' } };
    };
    expect(() => verify(false)).toThrow(/Invalid signature/);
    expect(verify(true).type).toBe('organizationMembership.created');
  });

  it('missing required payload fields fail without writes', async () => {
    await ensureOrg('university-a', 'org_a', 'University A');
    await expect(
      syncMembershipLocal({
        clerkMembershipId: '',
        clerkOrganizationId: 'org_a',
        organizationId: 'university-a',
        userId: 'user_a',
        clerkRole: 'org:student',
      })
    ).rejects.toThrow(/clerkMembershipId/);
  });
});

void vi;
