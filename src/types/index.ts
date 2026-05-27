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

export type { UserRole, LoginMode, AuthUser, AuthSession } from './auth';
export type {
  ResponderRole,
  ResponderProfile,
  Assignment,
  DispatchAlert,
} from './dispatch';

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Responder: undefined;
  Admin: undefined;
};

export type ResponderStackParamList = {
  ResponderShiftStart: undefined;
  ResponderMap: undefined;
  ResponderAssignments: undefined;
  ResponderAlertDetail: { alertId: string };
};

export type AdminStackParamList = {
  AdminDashboard: undefined;
  AdminOperationalDevices: undefined;
  AdminUnits: undefined;
  AdminShifts: undefined;
  AdminAnalytics: undefined;
  AdminIncidents: undefined;
  AdminIncidentDetail: { incidentId: string };
  AdminIncidentTimeline: { incidentId: string };
};

export type MainTabParamList = {
  Home: undefined;
  Community: undefined;
  Alert: undefined;
  Contacts: undefined;
  Profile: undefined;
};

export type AuthStackParamList = {
  AuthEntry: undefined;
  Login: undefined;
  ResponderLogin: undefined;
  AdminLogin: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
  MedicalInfo: undefined;
  EmergencyContacts: undefined;
  EmergencyMonitoring: undefined;
  Settings: undefined;
  PrivacyPolicy: undefined;
  Terms: undefined;
}; 