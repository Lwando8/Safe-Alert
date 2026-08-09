/**
 * Resolve the Firestore responderUnits document for a request context.
 * Membership stores unitCode (e.g. ALPHA-12); provisioned docs use ids like unit_lab_alpha_12.
 */
import { HttpsError } from 'firebase-functions/v2/https';
import type { RequestContext } from '../middleware/requestContext';
import { getDb } from '../firebaseApps';

const db = getDb();

export type ResolvedResponderUnit = {
  /** Firestore document id — use this on assignments / grants */
  docId: string;
  unitCode: string;
  responderType?: string;
  capabilities?: string[];
  active?: boolean;
};

export async function resolveResponderUnitForContext(
  context: RequestContext
): Promise<ResolvedResponderUnit> {
  const unitCode = String(context.unitId || '').trim();
  if (!unitCode) {
    throw new HttpsError('failed-precondition', 'No responder unit bound to membership');
  }

  // Prefer lookup by unitCode within tenant (platform provision path)
  const byCode = await db
    .collection('responderUnits')
    .where('organizationId', '==', context.organizationId)
    .where('unitCode', '==', unitCode)
    .limit(1)
    .get();

  if (!byCode.empty) {
    const doc = byCode.docs[0]!;
    const data = doc.data() as Record<string, unknown>;
    return {
      docId: doc.id,
      unitCode: String(data.unitCode || unitCode),
      responderType: data.responderType as string | undefined,
      capabilities: data.capabilities as string[] | undefined,
      active: data.active as boolean | undefined,
    };
  }

  // Fallback: document id equals unitCode / legacy unit id
  const byId = await db.doc(`responderUnits/${unitCode}`).get();
  if (byId.exists) {
    const data = byId.data() as Record<string, unknown>;
    const org = data.organizationId ? String(data.organizationId) : '';
    if (org && org !== context.organizationId) {
      throw new HttpsError('permission-denied', 'Responder unit not in organisation');
    }
    return {
      docId: byId.id,
      unitCode: String(data.unitCode || unitCode),
      responderType: data.responderType as string | undefined,
      capabilities: data.capabilities as string[] | undefined,
      active: data.active as boolean | undefined,
    };
  }

  throw new HttpsError(
    'failed-precondition',
    `Responder unit not found for code ${unitCode}`
  );
}

/** Match an assignment row to this unit (doc id or unit code). */
export function assignmentMatchesUnit(
  assignment: Record<string, unknown>,
  unit: { docId: string; unitCode: string }
): boolean {
  const rid = String(assignment.responderUnitId || assignment.responderId || '');
  const code = String(assignment.unitCode || '');
  return (
    rid === unit.docId ||
    rid === unit.unitCode ||
    code === unit.unitCode ||
    code === unit.docId
  );
}
