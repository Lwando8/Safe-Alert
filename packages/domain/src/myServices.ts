/**
 * Person-first "My Services" catalog — hybrid Phase F.
 * Presentation only: maps entitlements → existing app surfaces.
 * Does not implement SOS; SAFETY routes to existing Home.
 */

import type { PlatformModule } from './tenantConfig';
import type { Entitlement } from './entitlements';
import { personHasModuleEntitlement } from './entitlements';

/** Existing mobile / citizen surfaces (do not invent SOS rewrite). */
export type MyServiceRouteKey =
  | 'home_sos'
  | 'report_issue'
  | 'my_requests'
  | 'community_hub'
  | 'broadcasts'
  | 'ride_safety';

export interface MyServiceDefinition {
  id: string;
  moduleId: PlatformModule;
  title: string;
  description: string;
  route: MyServiceRouteKey;
  /** Ionicons-ish hint for clients */
  icon: string;
}

export interface MyServiceItem extends MyServiceDefinition {
  entitled: boolean;
  source?: Entitlement['source'];
}

/** Canonical catalog — UI may relabel via terminology later. */
export const MY_SERVICE_DEFINITIONS: MyServiceDefinition[] = [
  {
    id: 'svc_safety_sos',
    moduleId: 'SAFETY',
    title: 'Emergency SOS',
    description: 'Open Home to send an emergency alert (existing SOS path).',
    route: 'home_sos',
    icon: 'warning',
  },
  {
    id: 'svc_ops_report',
    moduleId: 'OPERATIONS',
    title: 'Report an issue',
    description: 'Submit a facilities / maintenance request.',
    route: 'report_issue',
    icon: 'construct',
  },
  {
    id: 'svc_ops_my_requests',
    moduleId: 'OPERATIONS',
    title: 'My requests',
    description: 'View facilities requests you submitted.',
    route: 'my_requests',
    icon: 'list',
  },
  {
    id: 'svc_ride_safety',
    moduleId: 'RIDE_SAFETY',
    title: 'Ride safety',
    description: 'Request a safe walk / ride escort (module foundation).',
    route: 'ride_safety',
    icon: 'car',
  },
  {
    id: 'svc_community',
    moduleId: 'COMMUNITY',
    title: 'Community',
    description: 'Groups, events, and neighbour alerts.',
    route: 'community_hub',
    icon: 'people',
  },
  {
    id: 'svc_community_alerts',
    moduleId: 'COMMUNITY_ALERTS',
    title: 'Community alerts',
    description: 'Missing pet and local community notices.',
    route: 'community_hub',
    icon: 'paw',
  },
  {
    id: 'svc_groups',
    moduleId: 'GROUPS',
    title: 'Groups',
    description: 'Campus or community groups.',
    route: 'community_hub',
    icon: 'people-circle',
  },
  {
    id: 'svc_events',
    moduleId: 'EVENTS',
    title: 'Events',
    description: 'Local events from your organisation.',
    route: 'community_hub',
    icon: 'calendar',
  },
  {
    id: 'svc_broadcasts',
    moduleId: 'BROADCASTS',
    title: 'Official broadcasts',
    description: 'Organisation announcements (not community alerts).',
    route: 'broadcasts',
    icon: 'megaphone',
  },
];

export function buildMyServicesCatalog(input: {
  entitlements: Entitlement[];
  organisationId?: string | null;
  /** When true, only return entitled rows (default). */
  entitledOnly?: boolean;
}): MyServiceItem[] {
  const entitledOnly = input.entitledOnly !== false;
  const items: MyServiceItem[] = [];

  for (const def of MY_SERVICE_DEFINITIONS) {
    const entitled = personHasModuleEntitlement(input.entitlements, def.moduleId, {
      organisationId: input.organisationId || undefined,
    });
    // Platform SAFETY still counts without org scope
    const entitledAny =
      entitled || personHasModuleEntitlement(input.entitlements, def.moduleId);

    if (entitledOnly && !entitledAny) continue;

    const match = input.entitlements.find(
      e => e.moduleId === def.moduleId && e.status === 'active'
    );
    items.push({
      ...def,
      entitled: entitledAny,
      source: match?.source,
    });
  }

  return items;
}

/** Relabel ops-facing copy using organisation terminology pack. */
export function relabelMyServices(
  services: MyServiceItem[],
  terminology?: { request?: string; organization?: string; member?: string } | null
): MyServiceItem[] {
  if (!terminology) return services;
  const requestLabel = terminology.request || 'Request';
  return services.map(s => {
    if (s.route === 'report_issue') {
      return {
        ...s,
        title: `Report a ${requestLabel.toLowerCase()}`,
        description: `Submit a ${requestLabel.toLowerCase()} to your ${
          terminology.organization || 'organisation'
        }.`,
      };
    }
    if (s.route === 'my_requests') {
      return {
        ...s,
        title: `My ${requestLabel.toLowerCase()}s`,
        description: `View ${requestLabel.toLowerCase()}s you submitted.`,
      };
    }
    return s;
  });
}
