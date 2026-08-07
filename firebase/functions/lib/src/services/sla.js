"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SLA_DUE_SOON_FRACTION = exports.DEFAULT_SLA_MS = exports.DEFAULT_SLA_MS_BY_PRIORITY = void 0;
exports.normalizeOpsPriority = normalizeOpsPriority;
exports.defaultSlaDurationMs = defaultSlaDurationMs;
exports.computeSlaTargetAt = computeSlaTargetAt;
exports.evaluateSlaStatus = evaluateSlaStatus;
exports.slaStatusLabel = slaStatusLabel;
exports.DEFAULT_SLA_MS_BY_PRIORITY = {
    urgent: 4 * 60 * 60 * 1000,
    high: 8 * 60 * 60 * 1000,
    normal: 24 * 60 * 60 * 1000,
    low: 72 * 60 * 60 * 1000,
};
exports.DEFAULT_SLA_MS = exports.DEFAULT_SLA_MS_BY_PRIORITY.normal;
exports.SLA_DUE_SOON_FRACTION = 0.2;
function normalizeOpsPriority(priority) {
    const p = String(priority || 'normal')
        .trim()
        .toLowerCase();
    if (p === 'critical' || p === 'emergency')
        return 'urgent';
    if (p === 'medium' || p === 'med' || !p)
        return 'normal';
    return p;
}
function defaultSlaDurationMs(priority) {
    const key = normalizeOpsPriority(priority);
    return exports.DEFAULT_SLA_MS_BY_PRIORITY[key] ?? exports.DEFAULT_SLA_MS;
}
function computeSlaTargetAt(input) {
    if (typeof input.slaTargetAt === 'number' && Number.isFinite(input.slaTargetAt)) {
        return input.slaTargetAt;
    }
    const now = typeof input.now === 'number' ? input.now : Date.now();
    if (typeof input.slaHours === 'number' && Number.isFinite(input.slaHours) && input.slaHours > 0) {
        return now + Math.round(input.slaHours * 60 * 60 * 1000);
    }
    return now + defaultSlaDurationMs(input.priority);
}
function evaluateSlaStatus(input) {
    const target = input.slaTargetAt;
    if (typeof target !== 'number' || !Number.isFinite(target))
        return 'none';
    const now = typeof input.now === 'number' ? input.now : Date.now();
    const status = String(input.status || '').toLowerCase();
    const terminal = status === 'resolved' || status === 'closed';
    const completedAt = typeof input.resolvedAt === 'number'
        ? input.resolvedAt
        : typeof input.closedAt === 'number'
            ? input.closedAt
            : terminal
                ? now
                : null;
    if (terminal && completedAt != null) {
        return completedAt <= target ? 'met' : 'breached';
    }
    if (now > target)
        return 'breached';
    const windowMs = typeof input.windowMs === 'number' && input.windowMs > 0
        ? input.windowMs
        : defaultSlaDurationMs(input.priority);
    const remaining = target - now;
    if (remaining <= windowMs * exports.SLA_DUE_SOON_FRACTION)
        return 'due_soon';
    return 'on_track';
}
function slaStatusLabel(status) {
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
