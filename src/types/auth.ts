export type AppRole =
  | 'CITIZEN'
  | 'RESPONDER_UNIT'
  | 'DISPATCHER'
  | 'SUPER_ADMIN';

/** @deprecated Use AppRole — kept for navigation compat */
export type UserRole = 'client' | 'responder' | 'admin';

export type LoginMode = 'client' | 'responder' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  appRole?: AppRole;
  name: string;
  phone?: string | null;
  responderUnitId?: string | null;
  responderRole?: string | null;
  providerId?: string | null;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  unit?: ResponderUnitSession;
  activeShift?: ShiftSession | null;
  requiresShift?: boolean;
}

export interface ResponderUnitSession {
  id: string;
  unitCode: string;
  responderType: string;
  organizationId?: string;
  vehicleRegistration?: string | null;
  status: string;
  active: boolean;
  loginId: string;
}

export interface ShiftSession {
  id: string;
  responderUnitId: string;
  primaryOfficerId: string;
  secondaryOfficerId?: string | null;
  startedAt: number;
  endedAt?: number | null;
  active: boolean;
  createdAt?: number;
}
