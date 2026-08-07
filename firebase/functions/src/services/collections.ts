/**
 * Canonical Firestore collection names (functions-local copy).
 */
export const COLLECTIONS = {
  organizations: 'organizations',
  sites: 'sites',
  zones: 'zones',
  memberships: 'memberships',
  identityLinks: 'identityLinks',
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
  rideSafetyRequests: 'rideSafetyRequests',
  orgDevices: 'orgDevices',
  webhookReceipts: 'webhookReceipts',
} as const;
