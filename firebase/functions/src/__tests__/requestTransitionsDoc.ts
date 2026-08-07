/** Mirrors tenantRequestService ALLOWED_TRANSITIONS for unit docs. */
export const ALLOWED_TRANSITIONS_DOC = {
  submitted: ['acknowledged', 'assigned', 'closed'],
  acknowledged: ['assigned', 'awaiting_information', 'on_hold', 'closed'],
  assigned: ['in_progress', 'awaiting_information', 'on_hold', 'closed'],
  in_progress: ['awaiting_information', 'on_hold', 'resolved', 'closed'],
  awaiting_information: ['in_progress', 'on_hold', 'assigned', 'closed'],
  on_hold: ['in_progress', 'assigned', 'awaiting_information', 'closed'],
  resolved: ['closed'],
  closed: [] as string[],
};
