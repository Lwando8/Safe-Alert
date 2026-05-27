export type ResponderRole = 'police' | 'armed_response' | 'ems';

export interface ResponderProfile {
  id: string;
  name: string;
  role: ResponderRole;
  providerId?: string | null;
}

export interface Assignment {
  responderId: string;
  name?: string;
  role: ResponderRole;
  providerId?: string | null;
  distanceKm?: number;
  etaMinutes?: number;
  status: 'pending' | 'accepted' | 'en_route' | 'on_scene' | 'resolved';
  timestamps?: Record<string, number>;
}

export interface Alert {
  id: string;
  type: 'sos' | 'security' | 'medical';
  location: { latitude: number; longitude: number };
  providerId?: string | null;
  assignments?: Assignment[];
  createdAt: number;
  locations?: Array<{ latitude: number; longitude: number; timestamp?: number }>;
}
