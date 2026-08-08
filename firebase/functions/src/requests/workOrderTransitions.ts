/**
 * Canonical operational request / work-order status transitions.
 * Used by tenantRequestService, unit tests, and mirrored by Ops web.
 *
 * Responder Accept on a create-on-assign work order uses: assigned → acknowledged.
 */
export type OperationalRequestStatus =
  | 'submitted'
  | 'acknowledged'
  | 'assigned'
  | 'in_progress'
  | 'awaiting_information'
  | 'on_hold'
  | 'resolved'
  | 'closed';

export const ALLOWED_TRANSITIONS: Record<
  OperationalRequestStatus,
  OperationalRequestStatus[]
> = {
  submitted: ['acknowledged', 'assigned', 'closed'],
  // After Accept (assigned → acknowledged), Start work: acknowledged → in_progress
  acknowledged: ['in_progress', 'assigned', 'awaiting_information', 'on_hold', 'closed'],
  // Responder "Accept" on a create-on-assign work order: assigned → acknowledged
  assigned: ['acknowledged', 'in_progress', 'awaiting_information', 'on_hold', 'closed'],
  in_progress: ['awaiting_information', 'on_hold', 'resolved', 'closed'],
  awaiting_information: ['in_progress', 'on_hold', 'assigned', 'closed'],
  on_hold: ['in_progress', 'assigned', 'awaiting_information', 'closed'],
  resolved: ['closed'],
  closed: [],
};

/** @deprecated Prefer ALLOWED_TRANSITIONS — kept for existing test imports */
export const ALLOWED_TRANSITIONS_FOR_TEST = ALLOWED_TRANSITIONS;

export function isOperationalRequestStatus(
  value: unknown
): value is OperationalRequestStatus {
  return typeof value === 'string' && value in ALLOWED_TRANSITIONS;
}

export function canTransitionWorkOrder(from: string, to: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[from as OperationalRequestStatus];
  if (!allowed) return false;
  return allowed.includes(to as OperationalRequestStatus);
}
