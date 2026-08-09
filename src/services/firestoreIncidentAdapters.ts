/**
 * Adapt Firestore incident callables to legacy DispatchAlert / MapNearby shapes
 * used by responder screens after SOS cutover.
 */
import type {
  Assignment,
  DispatchAlert,
  MapDispatchStatus,
  MapNearbyIncident,
  MapNearbyResponse,
} from '../types/dispatch';

function asAlertType(value: unknown): DispatchAlert['type'] {
  if (value === 'medical' || value === 'security' || value === 'sos') return value;
  return 'sos';
}

function asMapStatus(value: unknown): MapDispatchStatus {
  if (value === 'dispatched' || value === 'resolved' || value === 'unassigned') return value;
  return 'unassigned';
}

function asLocation(raw: unknown): { latitude: number; longitude: number } {
  if (!raw || typeof raw !== 'object') return { latitude: 0, longitude: 0 };
  const r = raw as Record<string, unknown>;
  const latitude =
    typeof r.latitude === 'number'
      ? r.latitude
      : typeof r.lat === 'number'
        ? r.lat
        : 0;
  const longitude =
    typeof r.longitude === 'number'
      ? r.longitude
      : typeof r.lng === 'number'
        ? r.lng
        : 0;
  return { latitude, longitude };
}

function asAssignments(raw: unknown): Assignment[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(a => {
    const row = (a || {}) as Record<string, unknown>;
    return {
      responderId: String(row.responderId || row.responderUnitId || ''),
      responderUnitId: row.responderUnitId ? String(row.responderUnitId) : undefined,
      name: row.unitCode ? String(row.unitCode) : undefined,
      role: String(row.role || row.responderType || 'police'),
      providerId: row.organizationId ? String(row.organizationId) : null,
      distanceKm: typeof row.distanceKm === 'number' ? row.distanceKm : undefined,
      etaMinutes: typeof row.etaMinutes === 'number' ? row.etaMinutes : undefined,
      status: (row.status as Assignment['status']) || 'pending',
      timestamps: (row.timestamps as Record<string, number>) || undefined,
    };
  });
}

export function incidentToDispatchAlert(raw: Record<string, unknown>): DispatchAlert {
  return {
    id: String(raw.id || ''),
    type: asAlertType(raw.type || raw.category),
    location: asLocation(raw.lastLocation || raw.location),
    providerId: raw.providerId ? String(raw.providerId) : raw.organizationId ? String(raw.organizationId) : null,
    assignments: asAssignments(raw.assignments),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    status: raw.status ? String(raw.status) : undefined,
  };
}

function findMyAssignment(
  assignments: Assignment[],
  unitHints: string[]
): Assignment | null {
  const hints = new Set(unitHints.filter(Boolean));
  if (!hints.size) return null;
  return (
    assignments.find(
      a =>
        hints.has(String(a.responderUnitId || '')) ||
        hints.has(String(a.responderId || '')) ||
        hints.has(String(a.name || ''))
    ) || null
  );
}

export function adaptNearbyIncidentsResponse(input: {
  radiusKm?: number;
  center?: { latitude: number; longitude: number } | null;
  incidents?: Array<Record<string, unknown>>;
  unitHints?: string[];
}): MapNearbyResponse {
  const unitHints = input.unitHints || [];
  const incidents: MapNearbyIncident[] = (input.incidents || []).map(raw => {
    const assignments = asAssignments(raw.assignments);
    const myAssignment = findMyAssignment(assignments, unitHints);
    const mapStatus = asMapStatus(raw.mapStatus);
    const canAccept = !myAssignment && mapStatus === 'unassigned';
    return {
      id: String(raw.id || ''),
      type: asAlertType(raw.type || raw.category),
      status: raw.status ? String(raw.status) : undefined,
      mapStatus,
      distanceKm: typeof raw.distanceKm === 'number' ? raw.distanceKm : 0,
      location: asLocation(raw.lastLocation || raw.location),
      createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
      assignments,
      myAssignment,
      canAccept,
    };
  });

  const active = incidents.find(
    i =>
      i.myAssignment &&
      ['accepted', 'en_route', 'on_scene', 'arrived'].includes(i.myAssignment.status)
  );

  return {
    radiusKm: typeof input.radiusKm === 'number' ? input.radiusKm : 25,
    center: input.center || { latitude: 0, longitude: 0 },
    incidents,
    activeJob: active
      ? {
          incidentId: active.id,
          assignment: active.myAssignment!,
          type: active.type,
        }
      : null,
  };
}
