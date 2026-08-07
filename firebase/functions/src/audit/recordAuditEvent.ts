import { getDb } from '../firebaseApps';
import { COLLECTIONS } from '../services/collections';

const db = getDb();

/**
 * Append-only audit event. Failures are logged but do not throw —
 * audit must not break operational write paths.
 */
export async function recordAuditEvent(input: {
  organizationId?: string | null;
  siteId?: string | null;
  actorUserId: string;
  actorPersonId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  reason?: string | null;
  accessGrantId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const ref = db.collection(COLLECTIONS.auditEvents).doc();
    await ref.set({
      id: ref.id,
      organizationId: input.organizationId ?? null,
      siteId: input.siteId ?? null,
      actorUserId: input.actorUserId,
      actorPersonId: input.actorPersonId ?? input.actorUserId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      timestamp: Date.now(),
      previousState: input.previousState ?? null,
      newState: input.newState ?? null,
      reason: input.reason ?? null,
      accessGrantId: input.accessGrantId ?? null,
      metadata: input.metadata || {},
    });
  } catch (err) {
    console.error('recordAuditEvent failed', err);
  }
}
