/**
 * Clerk → legacy ResponderProfile compatibility bridge.
 * Does not invent unit identity. Platform unitId / Express unit only.
 */
import type { ResponderProfile, ResponderRole, UnitStatus } from '../types/dispatch';

const RESPONDER_ROLES: ResponderRole[] = [
  'police',
  'metro_police',
  'armed_response',
  'medical',
  'community_patrol',
  'ems',
];

export type CompatUnitPayload = {
  id?: string;
  unitCode?: string;
  responderType?: string;
  organizationId?: string | null;
  vehicleRegistration?: string | null;
  status?: string;
  active?: boolean;
  loginId?: string;
};

export type ResolveUnitCodeInput = {
  /** PlatformSession.unitId from membership.responderProfile.unitCode */
  sessionUnitId?: string | null;
  /** Express /auth/clerk-compat `unit` when an Express unit record exists */
  compatUnit?: CompatUnitPayload | null;
};

/**
 * Authoritative unit code only — never invent CLERK-* synthetics.
 * Prefer Express unit record, then PlatformSession unitId.
 */
export function resolveAuthoritativeUnitCode(input: ResolveUnitCodeInput): string | null {
  const fromCompat = String(input.compatUnit?.unitCode || '').trim();
  if (fromCompat) return fromCompat;

  const fromSession = String(input.sessionUnitId || '').trim();
  if (!fromSession) return null;

  // Reject server-manufactured placeholders if they ever appear client-side
  if (/^CLERK-/i.test(fromSession)) return null;

  return fromSession;
}

export function shouldPersistClerkResponderProfile(input: {
  experience: 'user' | 'responder' | 'none' | string;
  canUseResponderExperience: boolean;
  unitCode: string | null;
}): boolean {
  if (input.experience !== 'responder') return false;
  if (!input.canUseResponderExperience) return false;
  if (!input.unitCode) return false;
  return true;
}

function asResponderRole(value: unknown): ResponderRole {
  if (typeof value === 'string' && RESPONDER_ROLES.includes(value as ResponderRole)) {
    return value as ResponderRole;
  }
  // Display/legacy Express field only — unit identity already resolved authoritatively
  return 'community_patrol';
}

function asUnitStatus(value: unknown): UnitStatus | undefined {
  const allowed: UnitStatus[] = [
    'offline',
    'available',
    'busy',
    'en_route',
    'at_scene',
    'emergency',
    'out_of_service',
  ];
  if (typeof value === 'string' && allowed.includes(value as UnitStatus)) {
    return value as UnitStatus;
  }
  return 'available';
}

/**
 * Build the minimum ResponderProfile ResponderNavigator already expects.
 */
export function buildClerkCompatResponderProfile(input: {
  personId: string;
  unitCode: string;
  organizationId?: string | null;
  compatUnit?: CompatUnitPayload | null;
}): ResponderProfile {
  const unit = input.compatUnit;
  const unitCode = String(unit?.unitCode || input.unitCode).trim();
  const organizationId = unit?.organizationId ?? input.organizationId ?? null;

  return {
    id: String(unit?.id || unitCode),
    unitCode,
    name: unitCode,
    role: asResponderRole(unit?.responderType),
    organizationId,
    providerId: organizationId,
    vehicleRegistration: unit?.vehicleRegistration ?? null,
    status: asUnitStatus(unit?.status),
  };
}
