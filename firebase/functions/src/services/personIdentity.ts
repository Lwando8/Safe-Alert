/**
 * Person-first identity seam.
 *
 * Compatibility rule (Phase B):
 *   personId === Clerk userId for existing records.
 * Do NOT re-key memberships / incidents / requests.
 * identityLinks remain the live Clerk↔Firebase store; IdentityAccount is the domain view.
 */

export type PersonStatus = 'active' | 'inactive' | 'suspended';

export interface Person {
  personId: string;
  status: PersonStatus;
  displayName?: string | null;
  createdAt: number;
  updatedAt: number;
}

export type IdentityProvider = 'CLERK' | 'FIREBASE';

export interface IdentityAccount {
  identityAccountId: string;
  personId: string;
  provider: IdentityProvider;
  providerSubjectId: string;
  status: 'active' | 'revoked';
  createdAt: number;
  updatedAt?: number;
}

/**
 * Compat: existing Clerk user ids are Seren person ids until a future migration.
 */
export function personIdFromClerkUserId(clerkUserId: string): string {
  if (!clerkUserId) throw new Error('clerkUserId required');
  return clerkUserId;
}

export function clerkUserIdFromPersonId(personId: string): string {
  return personId;
}

/** Deterministic identityAccount id for Clerk subject. */
export function clerkIdentityAccountId(clerkUserId: string): string {
  return `clerk:${clerkUserId}`;
}

/** Deterministic identityAccount id for Firebase uid. */
export function firebaseIdentityAccountId(firebaseUid: string): string {
  return `firebase:${firebaseUid}`;
}

/**
 * Adapt an identityLinks document into IdentityAccount views (Clerk + Firebase sides).
 */
export function identityAccountsFromLink(link: {
  id?: string;
  userId: string;
  clerkUserId: string;
  firebaseUid: string;
  status?: string;
  createdAt?: number;
  updatedAt?: number;
}): IdentityAccount[] {
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

export function buildPersonRecord(
  personId: string,
  partial?: Partial<Person>
): Person {
  const now = Date.now();
  return {
    personId,
    status: partial?.status || 'active',
    displayName: partial?.displayName ?? null,
    createdAt: partial?.createdAt || now,
    updatedAt: partial?.updatedAt || now,
  };
}
