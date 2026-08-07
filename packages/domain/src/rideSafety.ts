/**
 * Ride safety vertical foundation — hybrid Phase G.
 * Types only for matching/dispatch product later; create/list are additive stubs.
 * Does not rewrite Express SOS or implement trip matching.
 */

export type RideSafetyRequestStatus =
  | 'requested'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface RideSafetyRequest {
  id: string;
  organizationId: string;
  siteId?: string | null;
  zoneId?: string | null;
  /** Compat: equals Clerk userId / personId */
  requesterUserId: string;
  requesterPersonId: string;
  status: RideSafetyRequestStatus;
  /** Free-text pickup / destination labels — no live tracking required in Phase G */
  pickupLabel?: string | null;
  destinationLabel?: string | null;
  notes?: string | null;
  escortRequested?: boolean;
  assignedUserId?: string | null;
  createdAt: number;
  updatedAt: number;
  acceptedAt?: number | null;
  completedAt?: number | null;
  cancelledAt?: number | null;
}

export const RIDE_SAFETY_STATUS_TRANSITIONS: Record<
  RideSafetyRequestStatus,
  RideSafetyRequestStatus[]
> = {
  requested: ['accepted', 'cancelled'],
  accepted: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};
