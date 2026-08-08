/**
 * Client-side responder branch gates from PlatformSession capabilities.
 * Mirrors Phase D server filters — security (SOS/incidents) vs facilities (WOs).
 * Hybrid (both) keeps both surfaces visible for lab dual-cap accounts.
 */

const INCIDENT_CAPS = new Set([
  'INCIDENT_RESPONSE',
  'PATROL',
  'ACCESS_CONTROL',
]);

const FACILITIES_CAPS = new Set([
  'GENERAL_MAINTENANCE',
  'PLUMBING',
  'ELECTRICAL',
  'CLEANING',
  'IT_SUPPORT',
]);

export function normalizeCapabilityList(
  capabilities: string[] | null | undefined
): string[] {
  if (!Array.isArray(capabilities)) return [];
  return capabilities.map(c => String(c).trim()).filter(Boolean);
}

/** Express SOS / incident map + My jobs */
export function canAccessIncidentJobs(
  capabilities: string[] | null | undefined
): boolean {
  const caps = normalizeCapabilityList(capabilities);
  if (caps.length === 0) return true; // legacy unknown — keep SOS path
  return caps.some(c => INCIDENT_CAPS.has(c));
}

/** Firestore operational work orders */
export function canAccessFacilitiesWorkOrders(
  capabilities: string[] | null | undefined
): boolean {
  const caps = normalizeCapabilityList(capabilities);
  return caps.some(c => FACILITIES_CAPS.has(c));
}

export type ResponderBranchVisibility = {
  showIncidentJobs: boolean;
  showWorkOrders: boolean;
};

export function resolveResponderBranchVisibility(
  capabilities: string[] | null | undefined
): ResponderBranchVisibility {
  const showIncidentJobs = canAccessIncidentJobs(capabilities);
  const showWorkOrders = canAccessFacilitiesWorkOrders(capabilities);
  // Fail open to at least one surface so responders are never stranded.
  if (!showIncidentJobs && !showWorkOrders) {
    return { showIncidentJobs: true, showWorkOrders: false };
  }
  return { showIncidentJobs, showWorkOrders };
}
