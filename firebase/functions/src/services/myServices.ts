/**
 * Resolve person-first My Services payload from RequestContext.
 */
import type { RequestContext } from '../middleware/requestContext';
import { loadOrgTenantConfig } from './moduleGate';
import { resolvePersonEntitlements } from './entitlements';
import {
  buildMyServicesCatalog,
  relabelMyServices,
  type MyServiceItem,
} from './myServicesCatalog';
import { resolveTerminology, type TerminologyPack } from './tenantConfig';
import { ensurePersonForClerkUser } from './personService';
import { getDb } from '../firebaseApps';
import { COLLECTIONS } from './collections';

export type MyServicesPayload = {
  personId: string;
  organizationId: string;
  tenantProfile: string;
  terminology: {
    organization: string;
    site: string;
    member: string;
    request: string;
  };
  entitlements: Array<{
    entitlementId: string;
    moduleId: string;
    source: string;
    status: string;
  }>;
  services: MyServiceItem[];
};

export async function getMyServicesForContext(
  context: RequestContext
): Promise<MyServicesPayload> {
  try {
    await ensurePersonForClerkUser({ clerkUserId: context.userId });
  } catch (err) {
    console.error('ensurePersonForClerkUser on getMyServices failed (non-fatal)', err);
  }

  const cfg = await loadOrgTenantConfig(context.organizationId);

  let terminologyOverrides: Partial<TerminologyPack> | null = null;
  try {
    const snap = await getDb().doc(`${COLLECTIONS.organizations}/${context.organizationId}`).get();
    const settings = (snap.data()?.settings || {}) as { terminology?: Partial<TerminologyPack> };
    terminologyOverrides = settings.terminology || null;
  } catch {
    terminologyOverrides = null;
  }

  const entitlements = resolvePersonEntitlements({
    personId: context.userId,
    tenantProfile: cfg.tenantProfile,
    orgModules: cfg.modules,
    membership: {
      status: 'active',
      organizationId: context.organizationId,
    },
    platformModules: { SAFETY: true },
  });

  const terminology = resolveTerminology(cfg.tenantProfile, terminologyOverrides);
  const services = relabelMyServices(
    buildMyServicesCatalog({
      entitlements,
      organisationId: context.organizationId,
      entitledOnly: true,
    }),
    terminology
  );

  return {
    personId: context.userId,
    organizationId: context.organizationId,
    tenantProfile: cfg.tenantProfile,
    terminology: {
      organization: terminology.organization,
      site: terminology.site,
      member: terminology.member,
      request: terminology.request,
    },
    entitlements: entitlements.map(e => ({
      entitlementId: e.entitlementId,
      moduleId: e.moduleId,
      source: e.source,
      status: e.status,
    })),
    services,
  };
}
