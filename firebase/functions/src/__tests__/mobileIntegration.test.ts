import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TRANSITIONS_FOR_TEST,
  canTransitionWorkOrder,
} from '../requests/workOrderTransitions';

// Minimal pure helpers tested here — implementation lives beside service.

describe('work order status machine (shared with operational requests)', () => {
  it('allows assigned → acknowledged (responder Accept) and assigned → in_progress', () => {
    expect(canTransitionWorkOrder('assigned', 'acknowledged')).toBe(true);
    expect(canTransitionWorkOrder('assigned', 'in_progress')).toBe(true);
    expect(canTransitionWorkOrder('closed', 'assigned')).toBe(false);
  });

  it('allows acknowledged → in_progress (Start work after Accept)', () => {
    expect(canTransitionWorkOrder('acknowledged', 'in_progress')).toBe(true);
  });

  it('keeps resolved → closed only', () => {
    expect(ALLOWED_TRANSITIONS_FOR_TEST.resolved).toEqual(['closed']);
  });

  it('assigned transitions include acknowledged for create-on-assign accept', () => {
    expect(ALLOWED_TRANSITIONS_FOR_TEST.assigned).toContain('acknowledged');
  });
});

describe('push deep-link org isolation (contract)', () => {
  function validate(
    data: { organizationId?: string; workOrderId?: string } | null,
    activeOrgId: string | null
  ) {
    if (!data) return { ok: false as const, reason: 'empty_payload' };
    if (data.organizationId && activeOrgId && data.organizationId !== activeOrgId) {
      return { ok: false as const, reason: 'organization_mismatch' };
    }
    if (!data.workOrderId) return { ok: false as const, reason: 'missing_target' };
    return { ok: true as const };
  }

  it('rejects other-org notifications', () => {
    expect(
      validate({ organizationId: 'university-b', workOrderId: 'wo1' }, 'university-a').ok
    ).toBe(false);
  });

  it('accepts matching org', () => {
    expect(
      validate({ organizationId: 'university-a', workOrderId: 'wo1' }, 'university-a').ok
    ).toBe(true);
  });
});
