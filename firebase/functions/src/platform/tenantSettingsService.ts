import { HttpsError } from 'firebase-functions/v2/https';
import type { RequestContext } from '../middleware/requestContext';
import { authorize } from '../middleware/requestContext';
import { getDb } from '../firebaseApps';
import { COLLECTIONS } from '../services/collections';
import {
  buildOrganizationTenantDefaults,
  isPlatformModule,
  isTenantProfile,
  PLATFORM_MODULES,
  type ModuleFlags,
  type TenantProfile,
} from '../services/tenantConfig';
import { assertModuleEnabled } from '../services/moduleGate';

const db = getDb();

export async function getOrganizationTenantSettings(
  context: RequestContext,
  organizationId?: string
) {
  const orgId = organizationId || context.organizationId;
  if (!context.isPlatformOperator && orgId !== context.organizationId) {
    throw new HttpsError('permission-denied', 'Cannot read another organization');
  }
  if (!context.isPlatformOperator) {
    authorize(context, { permission: 'organization:manage' });
  }

  const snap = await db.doc(`${COLLECTIONS.organizations}/${orgId}`).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Organization not found');
  const data = snap.data() as Record<string, unknown>;
  const defaults = buildOrganizationTenantDefaults(
    isTenantProfile(data.tenantProfile) ? data.tenantProfile : 'UNIVERSITY'
  );
  const settings = (data.settings as Record<string, unknown>) || {};

  return {
    organizationId: orgId,
    name: data.name || orgId,
    slug: data.slug || orgId,
    status: data.status || 'active',
    tenantProfile: data.tenantProfile || defaults.tenantProfile,
    settings: {
      modules: settings.modules || defaults.settings.modules,
      terminology: settings.terminology || defaults.settings.terminology,
      operationalCategories:
        settings.operationalCategories || defaults.settings.operationalCategories,
      communityAlertCategories:
        settings.communityAlertCategories || defaults.settings.communityAlertCategories,
    },
  };
}

export async function updateOrganizationTenantSettings(
  context: RequestContext,
  input: {
    organizationId: string;
    tenantProfile?: string;
    modules?: Partial<ModuleFlags>;
    terminology?: Record<string, string>;
    operationalCategories?: unknown[];
    communityAlertCategories?: unknown[];
  }
) {
  if (!context.isPlatformOperator) {
    throw new HttpsError('permission-denied', 'Platform admin required');
  }
  if (!input.organizationId) {
    throw new HttpsError('invalid-argument', 'organizationId required');
  }

  const ref = db.doc(`${COLLECTIONS.organizations}/${input.organizationId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Organization not found');

  const data = snap.data() as Record<string, unknown>;
  const existingSettings =
    data.settings && typeof data.settings === 'object'
      ? (data.settings as Record<string, unknown>)
      : {};

  let tenantProfile: TenantProfile = isTenantProfile(data.tenantProfile)
    ? data.tenantProfile
    : 'UNIVERSITY';
  if (input.tenantProfile !== undefined) {
    if (!isTenantProfile(input.tenantProfile)) {
      throw new HttpsError('invalid-argument', 'Invalid tenantProfile');
    }
    tenantProfile = input.tenantProfile;
  }

  const modulesPatch: Partial<ModuleFlags> = {};
  if (input.modules && typeof input.modules === 'object') {
    for (const key of PLATFORM_MODULES) {
      if (typeof input.modules[key] === 'boolean') {
        modulesPatch[key] = input.modules[key];
      } else if (input.modules[key] !== undefined) {
        throw new HttpsError('invalid-argument', `Invalid module flag: ${key}`);
      }
    }
    // Validate keys aren't inventing modules
    for (const key of Object.keys(input.modules)) {
      if (!isPlatformModule(key)) {
        throw new HttpsError('invalid-argument', `Unknown module: ${key}`);
      }
    }
  }

  const nextSettings: Record<string, unknown> = {
    ...existingSettings,
    modules: {
      ...((existingSettings.modules as object) || {}),
      ...modulesPatch,
    },
  };
  if (input.terminology) nextSettings.terminology = input.terminology;
  if (input.operationalCategories) {
    nextSettings.operationalCategories = input.operationalCategories;
  }
  if (input.communityAlertCategories) {
    nextSettings.communityAlertCategories = input.communityAlertCategories;
  }

  await ref.set(
    {
      tenantProfile,
      settings: nextSettings,
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  return getOrganizationTenantSettings(context, input.organizationId);
}

export async function listAnalyticsEvents(
  context: RequestContext,
  options?: { limit?: number; kind?: string }
) {
  authorize(context, { permission: 'analytics:read' });
  await assertModuleEnabled(context.organizationId, 'ANALYTICS');

  const limit = Math.min(Math.max(Number(options?.limit) || 100, 1), 200);
  let query = db
    .collection(COLLECTIONS.analyticsEvents)
    .where('organizationId', '==', context.organizationId);

  if (options?.kind) {
    query = query.where('kind', '==', options.kind);
  }

  const list = await query.orderBy('createdAt', 'desc').limit(limit).get();
  return {
    organizationId: context.organizationId,
    events: list.docs.map(d => d.data()),
  };
}
