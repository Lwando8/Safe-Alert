import 'server-only';
import { getAdminDb } from './firebase-admin';
import { resolveOpsSession } from './ops-session';

export type OpsModuleFlags = {
  SAFETY: boolean;
  OPERATIONS: boolean;
  COMMUNITY: boolean;
  GROUPS: boolean;
  EVENTS: boolean;
  COMMUNITY_ALERTS: boolean;
  RIDE_SAFETY: boolean;
  BROADCASTS: boolean;
  ANALYTICS: boolean;
};

export type OpsTerminology = {
  organization: string;
  site: string;
  zone: string;
  member: string;
  responder: string;
  incident: string;
  request: string;
};

const DEFAULT_MODULES: OpsModuleFlags = {
  SAFETY: true,
  OPERATIONS: true,
  COMMUNITY: true,
  GROUPS: true,
  EVENTS: true,
  COMMUNITY_ALERTS: true,
  RIDE_SAFETY: true,
  BROADCASTS: true,
  ANALYTICS: true,
};

const DEFAULT_TERMINOLOGY: OpsTerminology = {
  organization: 'University',
  site: 'Campus',
  zone: 'Zone',
  member: 'Member',
  responder: 'Responder',
  incident: 'Incident',
  request: 'Request',
};

/**
 * Load effective modules + terminology for the active ops org.
 * Fail open to university defaults when org doc missing fields (additive migration).
 */
export async function loadOpsTenantPresentation(): Promise<{
  organizationId: string | null;
  modules: OpsModuleFlags;
  terminology: OpsTerminology;
  tenantProfile: string;
}> {
  const fallback = {
    organizationId: null as string | null,
    modules: DEFAULT_MODULES,
    terminology: DEFAULT_TERMINOLOGY,
    tenantProfile: 'UNIVERSITY',
  };

  const session = await resolveOpsSession();
  if (!session.ok) return fallback;

  try {
    const db = getAdminDb();
    const snap = await db.doc(`organizations/${session.organizationId}`).get();
    const data = (snap.data() || {}) as {
      tenantProfile?: string;
      settings?: {
        modules?: Partial<OpsModuleFlags>;
        terminology?: Partial<OpsTerminology>;
      };
    };
    return {
      organizationId: session.organizationId,
      tenantProfile: data.tenantProfile || 'UNIVERSITY',
      modules: { ...DEFAULT_MODULES, ...(data.settings?.modules || {}) },
      terminology: {
        ...DEFAULT_TERMINOLOGY,
        ...(data.settings?.terminology || {}),
      },
    };
  } catch {
    return { ...fallback, organizationId: session.organizationId };
  }
}
