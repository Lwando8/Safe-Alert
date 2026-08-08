import 'server-only';
import { clerkClient } from '@clerk/nextjs/server';
import { getAdminDb } from './firebase-admin';
import { assertPlatformAdminSession } from './ops-session';
import {
  derivePermissions,
  isAttachableClerkRole,
  mapRoleToKind,
  type AttachableClerkRole,
} from './membership-mapping';

export type PlatformMemberRow = {
  id: string;
  userId: string;
  personId?: string;
  organizationId: string;
  clerkOrganizationId?: string;
  clerkMembershipId?: string;
  clerkRole?: string;
  kind?: string;
  status: string;
  siteId?: string;
  updatedAt?: number;
};

function isLiveClerkOrganizationId(id: string | undefined | null): boolean {
  if (!id) return false;
  if (/^org_clerk_/i.test(id)) return false;
  return /^org_[a-zA-Z0-9]{16,}$/.test(id);
}

async function getDefaultSiteId(organizationId: string): Promise<string | null> {
  const db = getAdminDb();
  const byDefault = await db
    .collection('sites')
    .where('organizationId', '==', organizationId)
    .where('isDefault', '==', true)
    .limit(1)
    .get();
  if (!byDefault.empty) return byDefault.docs[0]!.id;

  const any = await db
    .collection('sites')
    .where('organizationId', '==', organizationId)
    .limit(1)
    .get();
  if (!any.empty) return any.docs[0]!.id;

  // Lab seed convention: {orgId}_main
  const conventional = `${organizationId}_main`;
  const snap = await db.doc(`sites/${conventional}`).get();
  return snap.exists ? conventional : null;
}

async function resolveClerkUserId(input: string): Promise<
  | { ok: true; userId: string; email: string | null }
  | { ok: false; code: string; message: string }
> {
  const raw = input.trim();
  if (!raw) {
    return { ok: false, code: 'invalid', message: 'Provide a Clerk user id or email.' };
  }

  try {
    const client = await clerkClient();
    if (raw.startsWith('user_')) {
      const user = await client.users.getUser(raw);
      const email =
        user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress ||
        user.emailAddresses[0]?.emailAddress ||
        null;
      return { ok: true, userId: user.id, email };
    }

    const list = await client.users.getUserList({ emailAddress: [raw], limit: 2 });
    if (list.data.length === 0) {
      return { ok: false, code: 'not_found', message: `No Clerk user for email ${raw}.` };
    }
    if (list.data.length > 1) {
      return {
        ok: false,
        code: 'invalid',
        message: 'Multiple Clerk users match that email — use user_… id.',
      };
    }
    const user = list.data[0]!;
    return { ok: true, userId: user.id, email: raw };
  } catch (err) {
    console.error('resolveClerkUserId failed', err);
    return {
      ok: false,
      code: 'unavailable',
      message: 'Unable to resolve Clerk user.',
    };
  }
}

async function ensurePerson(userId: string, email: string | null) {
  const db = getAdminDb();
  const now = Date.now();
  await db.doc(`persons/${userId}`).set(
    {
      id: userId,
      displayName: email || userId,
      primaryEmail: email,
      status: 'active',
      updatedAt: now,
      createdAt: now,
    },
    { merge: true }
  );
}

async function upsertFirestoreMembership(input: {
  organizationId: string;
  clerkOrganizationId: string;
  clerkMembershipId: string;
  userId: string;
  clerkRole: string;
  siteId: string;
  forceActive?: boolean;
}): Promise<{ membershipId: string; created: boolean }> {
  const db = getAdminDb();
  const kind = mapRoleToKind(input.clerkRole);
  const permissions = derivePermissions(input.clerkRole);
  const now = Date.now();

  const existingSnap = await db
    .collection('memberships')
    .where('clerkMembershipId', '==', input.clerkMembershipId)
    .limit(1)
    .get();

  const base = {
    clerkMembershipId: input.clerkMembershipId,
    clerkOrganizationId: input.clerkOrganizationId,
    organizationId: input.organizationId,
    userId: input.userId,
    personId: input.userId,
    kind,
    clerkRole: input.clerkRole,
    permissions,
    updatedAt: now,
  };

  if (existingSnap.empty) {
    // Also avoid duplicate active rows for same user+org
    const byUser = await db
      .collection('memberships')
      .where('userId', '==', input.userId)
      .where('organizationId', '==', input.organizationId)
      .limit(5)
      .get();
    const active = byUser.docs.find(d => d.data().status === 'active');
    if (active) {
      await active.ref.set(
        {
          ...base,
          status: 'active',
          siteId: active.data().siteId || input.siteId,
        },
        { merge: true }
      );
      return { membershipId: active.id, created: false };
    }

    const ref = db.collection('memberships').doc();
    await ref.set({
      ...base,
      id: ref.id,
      status: 'active',
      siteId: input.siteId,
      createdAt: now,
    });
    return { membershipId: ref.id, created: true };
  }

  const existing = existingSnap.docs[0]!;
  const prev = existing.data() as { status?: string; siteId?: string; organizationId?: string };
  if (prev.organizationId && prev.organizationId !== input.organizationId) {
    throw new Error(
      `Tenant conflict: membership maps to ${prev.organizationId}, not ${input.organizationId}`
    );
  }
  const nextStatus =
    input.forceActive || prev.status === 'active' || !prev.status
      ? 'active'
      : prev.status === 'suspended' || prev.status === 'revoked'
        ? prev.status
        : 'active';

  await existing.ref.set(
    {
      ...base,
      status: nextStatus,
      siteId: prev.siteId || input.siteId,
    },
    { merge: true }
  );
  return { membershipId: existing.id, created: false };
}

export async function listPlatformOrganizationMembers(organizationId: string): Promise<
  | { ok: true; members: PlatformMemberRow[]; labMode: boolean; clerkOrganizationId: string | null }
  | { ok: false; code: string; message: string }
> {
  const gate = await assertPlatformAdminSession();
  if (!gate.ok) return gate;

  try {
    const db = getAdminDb();
    const orgSnap = await db.doc(`organizations/${organizationId}`).get();
    if (!orgSnap.exists) {
      return { ok: false, code: 'not_found', message: 'Organization not found.' };
    }
    const org = orgSnap.data() as { clerkOrganizationId?: string };
    const clerkOrganizationId = org.clerkOrganizationId
      ? String(org.clerkOrganizationId)
      : null;

    const snap = await db
      .collection('memberships')
      .where('organizationId', '==', organizationId)
      .limit(200)
      .get();

    const members: PlatformMemberRow[] = snap.docs.map(doc => {
      const d = doc.data() as Record<string, unknown>;
      return {
        id: String(d.id || doc.id),
        userId: String(d.userId || ''),
        personId: d.personId ? String(d.personId) : undefined,
        organizationId: String(d.organizationId || organizationId),
        clerkOrganizationId: d.clerkOrganizationId
          ? String(d.clerkOrganizationId)
          : undefined,
        clerkMembershipId: d.clerkMembershipId
          ? String(d.clerkMembershipId)
          : undefined,
        clerkRole: d.clerkRole ? String(d.clerkRole) : undefined,
        kind: d.kind ? String(d.kind) : undefined,
        status: String(d.status || 'unknown'),
        siteId: d.siteId ? String(d.siteId) : undefined,
        updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : undefined,
      };
    });

    members.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    return {
      ok: true,
      members,
      labMode: !isLiveClerkOrganizationId(clerkOrganizationId),
      clerkOrganizationId,
    };
  } catch (err) {
    console.error('listPlatformOrganizationMembers failed', err);
    return { ok: false, code: 'unavailable', message: 'Unable to list members.' };
  }
}

export async function attachPlatformOrganizationMember(input: {
  organizationId: string;
  userRef: string;
  role?: string;
}): Promise<
  | {
      ok: true;
      membershipId: string;
      userId: string;
      mode: 'clerk+firestore' | 'firestore-lab';
      created: boolean;
      clerkRole: string;
    }
  | { ok: false; code: string; message: string }
> {
  const gate = await assertPlatformAdminSession();
  if (!gate.ok) return gate;

  const roleRaw = (input.role || 'org:student').trim();
  if (!isAttachableClerkRole(roleRaw)) {
    return {
      ok: false,
      code: 'invalid',
      message: `Role must be one of: org:student, org:staff, org:admin, org:member.`,
    };
  }
  const clerkRole: AttachableClerkRole = roleRaw;

  const resolved = await resolveClerkUserId(input.userRef);
  if (!resolved.ok) return resolved;

  try {
    const db = getAdminDb();
    const orgSnap = await db.doc(`organizations/${input.organizationId}`).get();
    if (!orgSnap.exists) {
      return { ok: false, code: 'not_found', message: 'Organization not found.' };
    }
    const org = orgSnap.data() as {
      clerkOrganizationId?: string;
      slug?: string;
      name?: string;
      id?: string;
    };
    // Memberships are keyed by Firestore org doc id (e.g. university-a), not Clerk org id.
    const organizationId = String(org.id || input.organizationId);
    const clerkOrganizationId = org.clerkOrganizationId
      ? String(org.clerkOrganizationId)
      : '';

    const siteId = await getDefaultSiteId(organizationId);
    if (!siteId) {
      return {
        ok: false,
        code: 'failed_precondition',
        message: 'Organization has no site — seed or configure a default site first.',
      };
    }

    await ensurePerson(resolved.userId, resolved.email);

    const live = isLiveClerkOrganizationId(clerkOrganizationId);
    const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

    if (live) {
      const client = await clerkClient();
      let clerkMembershipId = '';
      let createdInClerk = false;
      try {
        const created = await client.organizations.createOrganizationMembership({
          organizationId: clerkOrganizationId,
          userId: resolved.userId,
          role: clerkRole === 'org:member' ? 'org:member' : clerkRole,
        });
        clerkMembershipId = created.id;
        createdInClerk = true;
      } catch (err) {
        // Already a member — find existing membership and sync
        const msg = err instanceof Error ? err.message : String(err);
        const list = await client.organizations.getOrganizationMembershipList({
          organizationId: clerkOrganizationId,
          limit: 100,
        });
        const existing = list.data.find(
          m => m.publicUserData?.userId === resolved.userId
        );
        if (!existing) {
          console.error('createOrganizationMembership failed', err);
          return {
            ok: false,
            code: 'unavailable',
            message: `Clerk membership create failed: ${msg}`,
          };
        }
        clerkMembershipId = existing.id;
        if (existing.role !== clerkRole) {
          try {
            await client.organizations.updateOrganizationMembership({
              organizationId: clerkOrganizationId,
              userId: resolved.userId,
              role: clerkRole === 'org:member' ? 'org:member' : clerkRole,
            });
          } catch {
            // Role update optional — still sync existing role
          }
        }
      }

      const upserted = await upsertFirestoreMembership({
        organizationId,
        clerkOrganizationId,
        clerkMembershipId,
        userId: resolved.userId,
        clerkRole,
        siteId,
        forceActive: true,
      });

      return {
        ok: true,
        membershipId: upserted.membershipId,
        userId: resolved.userId,
        mode: 'clerk+firestore',
        created: createdInClerk || upserted.created,
        clerkRole,
      };
    }

    if (!emulator) {
      return {
        ok: false,
        code: 'failed_precondition',
        message:
          'Organization has no live Clerk organization id. Set clerkOrganizationId on the org, or use the Firebase emulator for lab Firestore-only attach.',
      };
    }

    // Lab / emulator: write Firestore membership without a live Clerk org (replaces seed script for students).
    const clerkMembershipId = `lab_${resolved.userId.slice(0, 20)}_${organizationId}`;
    const upserted = await upsertFirestoreMembership({
      organizationId,
      clerkOrganizationId: clerkOrganizationId || `lab_${organizationId}`,
      clerkMembershipId,
      userId: resolved.userId,
      clerkRole: clerkRole === 'org:member' ? 'org:student' : clerkRole,
      siteId,
      forceActive: true,
    });

    return {
      ok: true,
      membershipId: upserted.membershipId,
      userId: resolved.userId,
      mode: 'firestore-lab',
      created: upserted.created,
      clerkRole: clerkRole === 'org:member' ? 'org:student' : clerkRole,
    };
  } catch (err) {
    console.error('attachPlatformOrganizationMember failed', err);
    return {
      ok: false,
      code: 'unavailable',
      message: err instanceof Error ? err.message : 'Unable to attach member.',
    };
  }
}

/**
 * Pull all Clerk organization memberships into Firestore (live Clerk org only).
 * Replaces hand-running bootstrapOrganizationMemberships for platform admins.
 */
export async function syncPlatformOrganizationMembersFromClerk(organizationId: string): Promise<
  | {
      ok: true;
      synced: number;
      failed: number;
      total: number;
      clerkOrganizationId: string;
    }
  | { ok: false; code: string; message: string }
> {
  const gate = await assertPlatformAdminSession();
  if (!gate.ok) return gate;

  try {
    const db = getAdminDb();
    const orgSnap = await db.doc(`organizations/${organizationId}`).get();
    if (!orgSnap.exists) {
      return { ok: false, code: 'not_found', message: 'Organization not found.' };
    }
    const org = orgSnap.data() as {
      id?: string;
      clerkOrganizationId?: string;
      slug?: string;
    };
    const firestoreOrgId = String(org.id || organizationId);
    const clerkOrganizationId = org.clerkOrganizationId
      ? String(org.clerkOrganizationId)
      : '';

    if (!isLiveClerkOrganizationId(clerkOrganizationId)) {
      return {
        ok: false,
        code: 'failed_precondition',
        message:
          'Sync from Clerk requires a live clerkOrganizationId on this org. Lab/emulator orgs use Attach member (Firestore-only) instead.',
      };
    }

    const siteId = await getDefaultSiteId(firestoreOrgId);
    if (!siteId) {
      return {
        ok: false,
        code: 'failed_precondition',
        message: 'Organization has no site — configure a default site first.',
      };
    }

    const client = await clerkClient();
    const list = await client.organizations.getOrganizationMembershipList({
      organizationId: clerkOrganizationId,
      limit: 500,
    });
    const memberships = list.data || [];

    let synced = 0;
    let failed = 0;
    for (const membership of memberships) {
      try {
        const userId = membership.publicUserData?.userId;
        if (!userId) {
          failed += 1;
          continue;
        }
        const rawRole = String(membership.role || 'org:member');
        const clerkRole = rawRole === 'org:member' ? 'org:student' : rawRole;
        let email: string | null = null;
        try {
          const user = await client.users.getUser(userId);
          email =
            user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress ||
            user.emailAddresses[0]?.emailAddress ||
            null;
        } catch {
          // non-fatal
        }
        await ensurePerson(userId, email);
        await upsertFirestoreMembership({
          organizationId: firestoreOrgId,
          clerkOrganizationId,
          clerkMembershipId: membership.id,
          userId,
          clerkRole,
          siteId,
          forceActive: true,
        });
        synced += 1;
      } catch (err) {
        failed += 1;
        console.error('sync member failed', membership.id, err);
      }
    }

    return {
      ok: true,
      synced,
      failed,
      total: memberships.length,
      clerkOrganizationId,
    };
  } catch (err) {
    console.error('syncPlatformOrganizationMembersFromClerk failed', err);
    return {
      ok: false,
      code: 'unavailable',
      message: err instanceof Error ? err.message : 'Unable to sync members from Clerk.',
    };
  }
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Invite a new email into the org (live Clerk) or create+attach in lab emulator mode.
 * If the Clerk user already exists, falls through to attach.
 */
export async function invitePlatformOrganizationMember(input: {
  organizationId: string;
  email: string;
  role?: string;
  redirectUrl?: string;
}): Promise<
  | {
      ok: true;
      mode: 'org_invitation' | 'created+attached' | 'attached_existing';
      email: string;
      clerkRole: string;
      invitationId?: string;
      userId?: string;
      membershipId?: string;
      temporaryPassword?: string;
      note?: string;
    }
  | { ok: false; code: string; message: string }
> {
  const gate = await assertPlatformAdminSession();
  if (!gate.ok) return gate;

  const email = input.email.trim().toLowerCase();
  if (!looksLikeEmail(email)) {
    return { ok: false, code: 'invalid', message: 'Provide a valid email address.' };
  }

  const roleRaw = (input.role || 'org:student').trim();
  if (!isAttachableClerkRole(roleRaw)) {
    return {
      ok: false,
      code: 'invalid',
      message: `Role must be one of: org:student, org:staff, org:admin, org:member.`,
    };
  }
  const clerkRole: AttachableClerkRole = roleRaw;
  const clerkInviteRole = clerkRole === 'org:member' ? 'org:member' : clerkRole;

  // Existing user → attach
  const existing = await resolveClerkUserId(email);
  if (existing.ok) {
    const attached = await attachPlatformOrganizationMember({
      organizationId: input.organizationId,
      userRef: existing.userId,
      role: clerkRole,
    });
    if (!attached.ok) return attached;
    return {
      ok: true,
      mode: 'attached_existing',
      email,
      clerkRole: attached.clerkRole,
      userId: attached.userId,
      membershipId: attached.membershipId,
      note: 'User already existed in Clerk — attached membership.',
    };
  }
  if (existing.code !== 'not_found') {
    return existing;
  }

  try {
    const db = getAdminDb();
    const orgSnap = await db.doc(`organizations/${input.organizationId}`).get();
    if (!orgSnap.exists) {
      return { ok: false, code: 'not_found', message: 'Organization not found.' };
    }
    const org = orgSnap.data() as {
      id?: string;
      clerkOrganizationId?: string;
      name?: string;
    };
    const firestoreOrgId = String(org.id || input.organizationId);
    const clerkOrganizationId = org.clerkOrganizationId
      ? String(org.clerkOrganizationId)
      : '';
    const live = isLiveClerkOrganizationId(clerkOrganizationId);
    const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

    if (live) {
      const client = await clerkClient();
      const redirectUrl =
        input.redirectUrl ||
        process.env.NEXT_PUBLIC_PLATFORM_INVITE_REDIRECT_URL ||
        'http://127.0.0.1:3000/sign-in';
      try {
        const invitation = await client.organizations.createOrganizationInvitation({
          organizationId: clerkOrganizationId,
          emailAddress: email,
          role: clerkInviteRole,
          redirectUrl,
        });
        return {
          ok: true,
          mode: 'org_invitation',
          email,
          clerkRole,
          invitationId: invitation.id,
          note:
            'Clerk org invitation sent. After they accept, use Sync from Clerk (or wait for webhook) to materialize Firestore membership.',
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          code: 'unavailable',
          message: `Clerk org invitation failed: ${msg}`,
        };
      }
    }

    if (!emulator) {
      return {
        ok: false,
        code: 'failed_precondition',
        message:
          'Cannot invite to a lab/synthetic org outside the Firebase emulator. Set a live clerkOrganizationId, or run with FIRESTORE_EMULATOR_HOST.',
      };
    }

    // Lab: create Clerk user + Firestore membership immediately (no org invitation target).
    const client = await clerkClient();
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let temporaryPassword = 'SerenLab!';
    for (let i = 0; i < 10; i++) {
      temporaryPassword += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    let userId = '';
    try {
      const created = await client.users.createUser({
        emailAddress: [email],
        password: temporaryPassword,
        skipPasswordChecks: true,
        firstName: email.split('@')[0] || 'Member',
        publicMetadata: {},
      });
      userId = created.id;
      try {
        await client.users.updateUser(userId, { createOrganizationEnabled: false });
      } catch {
        // optional
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        code: 'unavailable',
        message: `Clerk user create failed: ${msg}`,
      };
    }

    const attached = await attachPlatformOrganizationMember({
      organizationId: firestoreOrgId,
      userRef: userId,
      role: clerkRole,
    });
    if (!attached.ok) {
      return {
        ok: false,
        code: attached.code,
        message: `User created (${userId}) but attach failed: ${attached.message}`,
      };
    }

    return {
      ok: true,
      mode: 'created+attached',
      email,
      clerkRole: attached.clerkRole,
      userId: attached.userId,
      membershipId: attached.membershipId,
      temporaryPassword,
      note: 'Lab user created with temporary password and Firestore membership. Share the password securely; change after first sign-in.',
    };
  } catch (err) {
    console.error('invitePlatformOrganizationMember failed', err);
    return {
      ok: false,
      code: 'unavailable',
      message: err instanceof Error ? err.message : 'Unable to invite member.',
    };
  }
}
