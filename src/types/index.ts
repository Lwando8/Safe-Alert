export interface SafetyReport {
  id: string;
  type: IncidentType;
  description: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  severity: number; // 1-5 scale
  timestamp: Date;
  userId: string;
  imageUrl?: string;
  status: 'pending' | 'verified' | 'resolved';
  verificationCount: number;
}

export type IncidentType = 
  | 'traffic-light'
  | 'crime'
  | 'hijack'
  | 'accident'
  | 'road-hazard'
  | 'police'
  | 'emergency';

export interface User {
  id: string;
  email: string;
  name: string;
  phoneNumber?: string;
  profileImageUrl?: string;
  emergencyContacts: EmergencyContact[];
  medicalInfo?: MedicalInfo;
  createdAt: Date;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phoneNumber: string;
  relationship: string;
  isPrimary: boolean;
}

export interface MedicalInfo {
  bloodType?: string;
  allergies: string[];
  medications: string[];
  medicalConditions: string[];
  emergencyMedicalInfo?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  timestamp: Date;
}

export interface IncidentTypeConfig {
  id: IncidentType;
  title: string;
  icon: string;
  color: string;
  description: string;
} 