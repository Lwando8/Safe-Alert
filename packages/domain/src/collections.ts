/**
 * Canonical Firestore collection names.
 * Prefer these over string literals in new code.
 */
export const COLLECTIONS = {
  organizations: 'organizations',
  sites: 'sites',
  zones: 'zones',
  memberships: 'memberships',
  identityLinks: 'identityLinks',
  /** Additive person registry — personId compat = Clerk userId */
  persons: 'persons',
  incidentAccessGrants: 'incidentAccessGrants',
  auditEvents: 'auditEvents',
  teams: 'teams',
  incidents: 'incidents',
  responderUnits: 'responderUnits',
  shifts: 'shifts',
  operationalRequests: 'operationalRequests',
  workOrders: 'workOrders',
  communityGroups: 'communityGroups',
  communityEvents: 'communityEvents',
  communityAlerts: 'communityAlerts',
  broadcasts: 'broadcasts',
  analyticsEvents: 'analyticsEvents',
  orgDevices: 'orgDevices',
  webhookReceipts: 'webhookReceipts',
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
