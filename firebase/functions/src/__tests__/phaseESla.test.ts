import { describe, expect, it } from 'vitest';
import {
  computeSlaTargetAt,
  defaultSlaDurationMs,
  evaluateSlaStatus,
  normalizeOpsPriority,
  slaStatusLabel,
} from '../services/sla';

describe('Phase E maintenance SLA', () => {
  it('normalizes priority aliases', () => {
    expect(normalizeOpsPriority('critical')).toBe('urgent');
    expect(normalizeOpsPriority('medium')).toBe('normal');
    expect(normalizeOpsPriority(undefined)).toBe('normal');
  });

  it('defaults SLA windows by priority', () => {
    expect(defaultSlaDurationMs('urgent')).toBe(4 * 60 * 60 * 1000);
    expect(defaultSlaDurationMs('high')).toBe(8 * 60 * 60 * 1000);
    expect(defaultSlaDurationMs('normal')).toBe(24 * 60 * 60 * 1000);
    expect(defaultSlaDurationMs('low')).toBe(72 * 60 * 60 * 1000);
  });

  it('computes target from priority, hours, or absolute', () => {
    const now = 1_700_000_000_000;
    expect(computeSlaTargetAt({ now, priority: 'urgent' })).toBe(
      now + 4 * 60 * 60 * 1000
    );
    expect(computeSlaTargetAt({ now, slaHours: 2 })).toBe(now + 2 * 60 * 60 * 1000);
    expect(computeSlaTargetAt({ now, slaTargetAt: now + 99, slaHours: 2 })).toBe(now + 99);
  });

  it('evaluates on_track / due_soon / breached / met', () => {
    const now = 1_000_000;
    const windowMs = 10_000;
    expect(
      evaluateSlaStatus({
        slaTargetAt: now + 9_000,
        now,
        windowMs,
        status: 'assigned',
      })
    ).toBe('on_track');
    expect(
      evaluateSlaStatus({
        slaTargetAt: now + 1_000,
        now,
        windowMs,
        status: 'in_progress',
      })
    ).toBe('due_soon');
    expect(
      evaluateSlaStatus({
        slaTargetAt: now - 1,
        now,
        status: 'assigned',
      })
    ).toBe('breached');
    expect(
      evaluateSlaStatus({
        slaTargetAt: now + 5_000,
        now: now + 4_000,
        status: 'resolved',
        resolvedAt: now + 4_000,
      })
    ).toBe('met');
    expect(
      evaluateSlaStatus({
        slaTargetAt: now + 1_000,
        now: now + 5_000,
        status: 'resolved',
        resolvedAt: now + 5_000,
      })
    ).toBe('breached');
    expect(evaluateSlaStatus({ slaTargetAt: null })).toBe('none');
  });

  it('labels statuses for UX', () => {
    expect(slaStatusLabel('due_soon')).toBe('Due soon');
    expect(slaStatusLabel('breached')).toBe('SLA breached');
  });
});
