import { getDb } from '../firebaseApps';
import { COLLECTIONS } from '../services/collections';
import type { AnalyticsEventKind } from './analyticsTypes';

const db = getDb();

/**
 * Append-only analytics event capture. Failures are logged but never throw —
 * metrics must not break operational write paths.
 */
export async function recordAnalyticsEvent(input: {
  organizationId: string;
  siteId?: string | null;
  zoneId?: string | null;
  kind: AnalyticsEventKind;
  category?: string | null;
  teamId?: string | null;
  resourceType: string;
  resourceId: string;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const ref = db.collection(COLLECTIONS.analyticsEvents).doc();
    await ref.set({
      id: ref.id,
      organizationId: input.organizationId,
      siteId: input.siteId ?? null,
      zoneId: input.zoneId ?? null,
      kind: input.kind,
      category: input.category ?? null,
      teamId: input.teamId ?? null,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      durationMs: input.durationMs ?? null,
      metadata: input.metadata || {},
      createdAt: Date.now(),
    });
  } catch (err) {
    console.error('recordAnalyticsEvent failed', err);
  }
}
