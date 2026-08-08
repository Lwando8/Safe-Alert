/**
 * Pure Clerk → ResponderProfile helpers (mirrors mobile `src/services/responderProfileBridge.ts`).
 * Kept under functions so CI vitest does not import Expo root tsconfig.
 */

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
  sessionUnitId?: string | null;
  compatUnit?: CompatUnitPayload | null;
};

/** Authoritative unit code only — never invent CLERK-* synthetics. */
export function resolveAuthoritativeUnitCode(input: ResolveUnitCodeInput): string | null {
  const fromCompat = String(input.compatUnit?.unitCode || '').trim();
  if (fromCompat) return fromCompat;

  const fromSession = String(input.sessionUnitId || '').trim();
  if (!fromSession) return null;
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

export type ClerkCompatResponderProfile = {
  id: string;
  unitCode: string;
  name: string;
  role: string;
  organizationId: string | null;
  providerId: string | null;
  vehicleRegistration: string | null;
  status: string;
};

export function buildClerkCompatResponderProfile(input: {
  personId: string;
  unitCode: string;
  organizationId?: string | null;
  compatUnit?: CompatUnitPayload | null;
}): ClerkCompatResponderProfile {
  const unit = input.compatUnit;
  const unitCode = String(unit?.unitCode || input.unitCode).trim();
  const organizationId = unit?.organizationId ?? input.organizationId ?? null;

  return {
    id: String(unit?.id || unitCode),
    unitCode,
    name: unitCode,
    role: typeof unit?.responderType === 'string' ? unit.responderType : 'community_patrol',
    organizationId,
    providerId: organizationId,
    vehicleRegistration: unit?.vehicleRegistration ?? null,
    status: typeof unit?.status === 'string' ? unit.status : 'available',
  };
}
