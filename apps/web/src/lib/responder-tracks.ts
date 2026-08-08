/**
 * Lab / platform responder tracks — mirrors scripts/seed-device-clerk-membership.js.
 * security = SOS/incidents; facilities = WO; hybrid = lab dual-cap only.
 */

export const RESPONDER_TRACKS = ['security', 'facilities', 'hybrid'] as const;
export type ResponderTrack = (typeof RESPONDER_TRACKS)[number];

export function isResponderTrack(value: string): value is ResponderTrack {
  return (RESPONDER_TRACKS as readonly string[]).includes(value);
}

export const RESPONDER_PERMISSIONS = [
  'incidents:read-all',
  'incidents:acknowledge',
  'incidents:update',
  'responders:read',
  'sites:read',
  'requests:read-all',
  'requests:update',
  'requests:resolve',
] as const;

export type ResponderTrackConfig = {
  kind: 'security_guard' | 'facilities';
  clerkRole: 'org:responder' | 'org:facilities';
  responderType: string;
  capabilities: string[];
  unitCode: string;
  firestoreUnitId: string;
  teamIds: string[];
  seedLabWorkOrder: boolean;
  expressLoginId: string | null;
};

export function resolveResponderTrack(
  track: ResponderTrack,
  expressUnitCode = 'ALPHA-12'
): ResponderTrackConfig {
  const code = expressUnitCode.trim().toUpperCase() || 'ALPHA-12';
  if (track === 'facilities') {
    return {
      kind: 'facilities',
      clerkRole: 'org:facilities',
      responderType: 'facilities',
      capabilities: ['GENERAL_MAINTENANCE', 'PLUMBING', 'ELECTRICAL', 'CLEANING'],
      unitCode: 'FAC-LAB',
      firestoreUnitId: 'unit_lab_fac_lab',
      teamIds: ['team_a_facilities'],
      seedLabWorkOrder: true,
      expressLoginId: null,
    };
  }
  if (track === 'hybrid') {
    return {
      kind: 'security_guard',
      clerkRole: 'org:responder',
      responderType: 'police',
      capabilities: ['INCIDENT_RESPONSE', 'PATROL', 'GENERAL_MAINTENANCE'],
      unitCode: code,
      firestoreUnitId: `unit_lab_${code.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      teamIds: ['team_a_facilities'],
      seedLabWorkOrder: true,
      expressLoginId: code,
    };
  }
  return {
    kind: 'security_guard',
    clerkRole: 'org:responder',
    responderType: 'police',
    capabilities: ['INCIDENT_RESPONSE', 'PATROL'],
    unitCode: code,
    firestoreUnitId: `unit_lab_${code.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    teamIds: [],
    seedLabWorkOrder: false,
    expressLoginId: code,
  };
}
