/**
 * Shared transition table for operational requests / work orders.
 * Exported for unit tests; service imports the same rules inline.
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

export const ALLOWED_TRANSITIONS_FOR_TEST: Record<
  OperationalRequestStatus,
  OperationalRequestStatus[]
> = {
  submitted: ['acknowledged', 'assigned', 'closed'],
  acknowledged: ['assigned', 'awaiting_information', 'on_hold', 'closed'],
  assigned: ['in_progress', 'awaiting_information', 'on_hold', 'closed'],
  in_progress: ['awaiting_information', 'on_hold', 'resolved', 'closed'],
  awaiting_information: ['in_progress', 'on_hold', 'assigned', 'closed'],
  on_hold: ['in_progress', 'assigned', 'awaiting_information', 'closed'],
  resolved: ['closed'],
  closed: [],
};

export function canTransitionWorkOrder(from: string, to: string): boolean {
  const allowed = ALLOWED_TRANSITIONS_FOR_TEST[from as OperationalRequestStatus];
  if (!allowed) return false;
  return allowed.includes(to as OperationalRequestStatus);
}
