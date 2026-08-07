/**
 * Responder capability helpers — Phase D.
 * Security (incident) vs maintenance (ops request) assignment filters.
 * Does not rewrite Express SOS marketplace matching.
 */

export const RESPONDER_CAPABILITIES = [
  'INCIDENT_RESPONSE',
  'PATROL',
  'ACCESS_CONTROL',
  'PLUMBING',
  'ELECTRICAL',
  'GENERAL_MAINTENANCE',
  'IT_SUPPORT',
  'CLEANING',
] as const;

export type CanonicalResponderCapability = (typeof RESPONDER_CAPABILITIES)[number];

/** Normalize open-string responderType for default capability mapping. */
export function normalizeResponderType(responderType: string | null | undefined): string {
  const raw = String(responderType || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  const aliases: Record<string, string> = {
    CAMPUS_SECURITY: 'SECURITY',
    SECURITY_GUARD: 'SECURITY',
    METRO_POLICE: 'SECURITY',
    ARMED_RESPONSE: 'SECURITY',
    POLICE: 'SECURITY',
    GENERAL_FACILITIES: 'FACILITIES',
    FACILITY: 'FACILITIES',
  };
  return aliases[raw] || raw;
}

/**
 * Defaults when `capabilities[]` is absent (legacy units / memberships).
 * Maintenance types do NOT get INCIDENT_RESPONSE — keeps SOS units separate.
 */
export function defaultCapabilitiesForResponderType(
  responderType: string | null | undefined
): string[] {
  switch (normalizeResponderType(responderType)) {
    case 'SECURITY':
    case 'FIRE':
      return ['INCIDENT_RESPONSE', 'PATROL'];
    case 'MEDICAL':
      return ['INCIDENT_RESPONSE'];
    case 'MAINTENANCE':
    case 'FACILITIES':
      return ['GENERAL_MAINTENANCE'];
    case 'IT':
      return ['IT_SUPPORT'];
    case 'OTHER':
      return [];
    default:
      return [];
  }
}

/** Membership kind fallback when no unit type / capabilities are set. */
export function defaultCapabilitiesForMembershipKind(
  kind: string | null | undefined
): string[] {
  switch (String(kind || '').toLowerCase()) {
    case 'security_guard':
    case 'responder':
    case 'control_room':
      return ['INCIDENT_RESPONSE', 'PATROL'];
    case 'facilities':
      return [
        'GENERAL_MAINTENANCE',
        'PLUMBING',
        'ELECTRICAL',
        'CLEANING',
        'IT_SUPPORT',
      ];
    default:
      return [];
  }
}

export function resolveEffectiveCapabilities(input: {
  capabilities?: string[] | null;
  responderType?: string | null;
  membershipKind?: string | null;
}): string[] {
  if (Array.isArray(input.capabilities) && input.capabilities.length > 0) {
    return Array.from(new Set(input.capabilities.map(c => String(c).trim()).filter(Boolean)));
  }
  if (input.responderType) {
    const fromType = defaultCapabilitiesForResponderType(input.responderType);
    if (fromType.length) return fromType;
  }
  return defaultCapabilitiesForMembershipKind(input.membershipKind);
}

export function hasCapability(
  capabilities: string[] | null | undefined,
  required: string
): boolean {
  return Array.isArray(capabilities) && capabilities.includes(required);
}

export function hasAnyCapability(
  capabilities: string[] | null | undefined,
  required: string[]
): boolean {
  if (!Array.isArray(capabilities) || !required.length) return false;
  return required.some(r => capabilities.includes(r));
}

/** Emergency Firestore incidents require incident-response capability. */
export function requiredCapabilitiesForIncident(
  _incidentType?: string | null
): string[] {
  return ['INCIDENT_RESPONSE'];
}

/**
 * Ops request category → acceptable capabilities (any-of).
 * GENERAL_MAINTENANCE is a broad facilities fallback for most campus categories.
 */
export function requiredCapabilitiesForRequestCategory(category: string | null | undefined): string[] {
  const c = String(category || '')
    .trim()
    .toLowerCase();
  switch (c) {
    case 'plumbing':
    case 'water_leak':
      return ['PLUMBING', 'GENERAL_MAINTENANCE'];
    case 'electrical':
    case 'lighting':
      return ['ELECTRICAL', 'GENERAL_MAINTENANCE'];
    case 'cleaning':
    case 'waste':
    case 'landscaping':
      return ['CLEANING', 'GENERAL_MAINTENANCE'];
    case 'it':
      return ['IT_SUPPORT', 'GENERAL_MAINTENANCE'];
    case 'building_maintenance':
    case 'infrastructure_damage':
    case 'roads':
    case 'parking':
    case 'general_facilities':
    case 'asset_damage':
    case 'other':
    default:
      return ['GENERAL_MAINTENANCE'];
  }
}

export function canRespondToIncident(input: {
  capabilities?: string[] | null;
  responderType?: string | null;
  membershipKind?: string | null;
  incidentType?: string | null;
}): boolean {
  const caps = resolveEffectiveCapabilities(input);
  return hasAnyCapability(caps, requiredCapabilitiesForIncident(input.incidentType));
}

export function canHandleRequestCategory(input: {
  capabilities?: string[] | null;
  responderType?: string | null;
  membershipKind?: string | null;
  teamKind?: string | null;
  category: string | null | undefined;
}): boolean {
  const caps = resolveEffectiveCapabilities({
    capabilities: input.capabilities,
    responderType: input.responderType || input.teamKind,
    membershipKind: input.membershipKind,
  });
  return hasAnyCapability(caps, requiredCapabilitiesForRequestCategory(input.category));
}

/** Team kind vocabulary → default capabilities (when team.capabilities absent). */
export function defaultCapabilitiesForTeamKind(kind: string | null | undefined): string[] {
  switch (String(kind || '')
    .trim()
    .toLowerCase()) {
    case 'security':
      return ['INCIDENT_RESPONSE', 'PATROL'];
    case 'plumbing':
      return ['PLUMBING', 'GENERAL_MAINTENANCE'];
    case 'electrical':
      return ['ELECTRICAL', 'GENERAL_MAINTENANCE'];
    case 'it':
      return ['IT_SUPPORT'];
    case 'cleaning':
      return ['CLEANING', 'GENERAL_MAINTENANCE'];
    case 'maintenance':
    case 'facilities':
      return ['GENERAL_MAINTENANCE', 'PLUMBING', 'ELECTRICAL', 'CLEANING'];
    default:
      return defaultCapabilitiesForResponderType(kind);
  }
}
