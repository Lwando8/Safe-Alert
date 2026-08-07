export type AnalyticsEventKind =
  | 'incident_created'
  | 'incident_resolved'
  | 'request_created'
  | 'request_assigned'
  | 'request_resolved'
  | 'community_alert_created'
  | 'community_alert_resolved'
  | 'broadcast_published'
  | 'sla_missed'
  | 'sla_met';
