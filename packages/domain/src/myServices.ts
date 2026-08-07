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
  | 'broadcasts';

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
