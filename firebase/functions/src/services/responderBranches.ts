/**
 * Pure capability → UI branch helpers (mirrors mobile `src/auth/responderBranches.ts`).
 * Kept under functions so CI vitest does not import Expo root tsconfig.
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

export function canAccessIncidentJobs(
  capabilities: string[] | null | undefined
): boolean {
  const caps = normalizeCapabilityList(capabilities);
  if (caps.length === 0) return true;
  return caps.some(c => INCIDENT_CAPS.has(c));
}

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
  if (!showIncidentJobs && !showWorkOrders) {
    return { showIncidentJobs: true, showWorkOrders: false };
  }
  return { showIncidentJobs, showWorkOrders };
}
