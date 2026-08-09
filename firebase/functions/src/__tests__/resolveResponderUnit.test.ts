import { describe, expect, it } from 'vitest';
import { assignmentMatchesUnit } from '../services/resolveResponderUnit';

describe('resolveResponderUnit assignment matching', () => {
  const unit = { docId: 'unit_lab_alpha_12', unitCode: 'ALPHA-12' };

  it('matches by Firestore doc id', () => {
    expect(
      assignmentMatchesUnit({ responderUnitId: 'unit_lab_alpha_12' }, unit)
    ).toBe(true);
  });

  it('matches by unitCode field', () => {
    expect(assignmentMatchesUnit({ unitCode: 'ALPHA-12' }, unit)).toBe(true);
  });

  it('matches when responderId is unit code', () => {
    expect(assignmentMatchesUnit({ responderId: 'ALPHA-12' }, unit)).toBe(true);
  });

  it('rejects other units', () => {
    expect(
      assignmentMatchesUnit({ responderUnitId: 'unit_other', unitCode: 'OTHER' }, unit)
    ).toBe(false);
  });
});
