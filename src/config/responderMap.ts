/** Default search radius for distress calls visible on responder map (km) */
export const RESPONDER_MAP_RADIUS_KM = 15;

export const MAP_STATUS_COLORS = {
  unassigned: '#ef4444',
  dispatched: '#eab308',
  resolved: '#22c55e',
  unit: '#3b82f6',
} as const;

export const MAP_STATUS_LABELS = {
  unassigned: 'Needs response',
  dispatched: 'Unit dispatched',
  resolved: 'Resolved',
} as const;
