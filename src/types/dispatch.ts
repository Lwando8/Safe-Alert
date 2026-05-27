export type ResponderRole =
  | 'police'
  | 'metro_police'
  | 'armed_response'
  | 'medical'
  | 'community_patrol'
  | 'ems';

export type UnitStatus =
  | 'offline'
  | 'available'
  | 'busy'
  | 'en_route'
  | 'at_scene'
  | 'emergency'
  | 'out_of_service';

export interface ResponderProfile {
  id: string;
  unitCode: string;
  name: string;
  role: ResponderRole;
  organizationId?: string | null;
  providerId?: string | null;
  vehicleRegistration?: string | null;
  status?: UnitStatus;
}

export interface Assignment {
  responderId: string;
  responderUnitId?: string;
  name?: string;
  role: ResponderRole | string;
  providerId?: string | null;
  distanceKm?: number;
  etaMinutes?: number;
  status: 'pending' | 'accepted' | 'en_route' | 'on_scene' | 'arrived' | 'resolved' | 'declined';
  timestamps?: Record<string, number>;
}

export interface DispatchAlert {
  id: string;
  type: 'sos' | 'security' | 'medical';
  location: { latitude: number; longitude: number };
  providerId?: string | null;
  assignments?: Assignment[];
  createdAt: number;
  locations?: Array<{ latitude: number; longitude: number; timestamp?: number }>;
  status?: string;
}

export type MapDispatchStatus = 'unassigned' | 'dispatched' | 'resolved';

export interface MapNearbyIncident {
  id: string;
  type: DispatchAlert['type'];
  status?: string;
  mapStatus: MapDispatchStatus;
  distanceKm: number;
  location: { latitude: number; longitude: number };
  createdAt: number;
  assignments?: Assignment[];
  myAssignment?: Assignment | null;
  canAccept: boolean;
}

export interface MapNearbyResponse {
  radiusKm: number;
  center: { latitude: number; longitude: number };
  incidents: MapNearbyIncident[];
  activeJob: {
    incidentId: string;
    assignment: Assignment;
    type: DispatchAlert['type'];
  } | null;
}

export interface IncidentTimelineEvent {
  id: string;
  incidentId: string;
  responderUnitId?: string | null;
  shiftSessionId?: string | null;
  eventType: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}
