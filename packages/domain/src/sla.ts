/**
 * Maintenance SLA helpers — hybrid Phase E.
 * Priority → default target duration; status evaluation for ops UX.
 * Does not change stored operationalRequest status enums.
 */

export type OpsPriority = 'low' | 'normal' | 'high' | 'urgent' | string;

/** Default SLA windows from assign time (ms). */
export const DEFAULT_SLA_MS_BY_PRIORITY: Record<string, number> = {
  urgent: 4 * 60 * 60 * 1000, // 4h
  high: 8 * 60 * 60 * 1000, // 8h
  normal: 24 * 60 * 60 * 1000, // 24h
  low: 72 * 60 * 60 * 1000, // 72h
};

export const DEFAULT_SLA_MS = DEFAULT_SLA_MS_BY_PRIORITY.normal!;

/** Warn when remaining time is under this fraction of the window. */
export const SLA_DUE_SOON_FRACTION = 0.2;

export type SlaStatus = 'none' | 'on_track' | 'due_soon' | 'breached' | 'met';

export function normalizeOpsPriority(priority: string | null | undefined): string {
  const p = String(priority || 'normal')
    .trim()
    .toLowerCase();
  if (p === 'critical' || p === 'emergency') return 'urgent';
  if (p === 'medium' || p === 'med' || !p) return 'normal';
  return p;
}

export function defaultSlaDurationMs(priority: string | null | undefined): number {
  const key = normalizeOpsPriority(priority);
  return DEFAULT_SLA_MS_BY_PRIORITY[key] ?? DEFAULT_SLA_MS;
}

export function computeSlaTargetAt(input: {
  now?: number;
  priority?: string | null;
  /** Explicit override (ms absolute). */
  slaTargetAt?: number | null;
  /** Relative hours from now (UI helper). */
  slaHours?: number | null;
}): number | null {
  if (typeof input.slaTargetAt === 'number' && Number.isFinite(input.slaTargetAt)) {
    return input.slaTargetAt;
  }
  const now = typeof input.now === 'number' ? input.now : Date.now();
  if (typeof input.slaHours === 'number' && Number.isFinite(input.slaHours) && input.slaHours > 0) {
    return now + Math.round(input.slaHours * 60 * 60 * 1000);
  }
  return now + defaultSlaDurationMs(input.priority);
}

/**
 * Evaluate SLA for display / analytics hooks.
 * Terminal statuses (resolved/closed) → met if completed before target, else breached.
 */
export function evaluateSlaStatus(input: {
  slaTargetAt?: number | null;
  now?: number;
  status?: string | null;
  resolvedAt?: number | null;
  closedAt?: number | null;
  /** Full window length when known; used for due_soon. */
  windowMs?: number | null;
  priority?: string | null;
}): SlaStatus {
  const target = input.slaTargetAt;
  if (typeof target !== 'number' || !Number.isFinite(target)) return 'none';

  const now = typeof input.now === 'number' ? input.now : Date.now();
  const status = String(input.status || '').toLowerCase();
  const terminal = status === 'resolved' || status === 'closed';
  const completedAt =
    typeof input.resolvedAt === 'number'
      ? input.resolvedAt
      : typeof input.closedAt === 'number'
        ? input.closedAt
        : terminal
          ? now
          : null;

  if (terminal && completedAt != null) {
    return completedAt <= target ? 'met' : 'breached';
  }

  if (now > target) return 'breached';

  const windowMs =
    typeof input.windowMs === 'number' && input.windowMs > 0
      ? input.windowMs
      : defaultSlaDurationMs(input.priority);
  const remaining = target - now;
  if (remaining <= windowMs * SLA_DUE_SOON_FRACTION) return 'due_soon';
  return 'on_track';
}

export function slaStatusLabel(status: SlaStatus): string {
  switch (status) {
    case 'on_track':
      return 'On track';
    case 'due_soon':
      return 'Due soon';
    case 'breached':
      return 'SLA breached';
    case 'met':
      return 'SLA met';
    default:
      return 'No SLA';
  }
}
