/**
 * Pure client-side experience routing from platform session fields.
 * Mirrors firebase/functions/src/services/experienceRouting.ts — keep in sync.
 * Never infer role from email.
 */

export type MobileExperience = 'user' | 'responder' | 'none';

export const RESPONDER_MEMBERSHIP_KINDS = new Set([
  'security_guard',
  'control_room',
  'facilities',
  'contractor',
  'org_admin',
]);

export const RESPONDER_PERMISSION_HINTS = [
  'incidents:acknowledge',
  'incidents:assign',
  'incidents:read-all',
  'responders:read',
  'responders:manage',
  'requests:assign',
] as const;

export type ExperienceRoutingInput = {
  membershipStatus?: string | null;
  role?: string | null;
  permissions?: string[] | null;
  capabilities?: string[] | null;
  unitId?: string | null;
  canUseUserExperience?: boolean | null;
  canUseResponderExperience?: boolean | null;
  lastExperience?: MobileExperience | null;
};

export function canUseResponderExperience(input: ExperienceRoutingInput): boolean {
  if (typeof input.canUseResponderExperience === 'boolean') {
    return input.canUseResponderExperience;
  }
  if (input.membershipStatus && input.membershipStatus !== 'active') return false;
  if (input.unitId) return true;
  if (input.role && RESPONDER_MEMBERSHIP_KINDS.has(String(input.role))) return true;
  if (Array.isArray(input.capabilities) && input.capabilities.length > 0) return true;
  const perms = Array.isArray(input.permissions) ? input.permissions : [];
  return RESPONDER_PERMISSION_HINTS.some(p => perms.includes(p));
}

export function canUseUserExperience(input: ExperienceRoutingInput): boolean {
  if (typeof input.canUseUserExperience === 'boolean') {
    return input.canUseUserExperience;
  }
  if (input.membershipStatus && input.membershipStatus !== 'active') return false;
  return true;
}

export function resolveMobileExperience(input: ExperienceRoutingInput): MobileExperience {
  const status = input.membershipStatus || 'active';
  if (status === 'invited' || status === 'pending') return 'none';
  if (status === 'revoked' || status === 'suspended') return 'none';

  const userOk = canUseUserExperience(input);
  const responderOk = canUseResponderExperience(input);

  if (!userOk && !responderOk) return 'none';
  if (responderOk && !userOk) return 'responder';
  if (userOk && !responderOk) return 'user';

  if (input.lastExperience === 'responder' || input.lastExperience === 'user') {
    return input.lastExperience;
  }
  return 'responder';
}
