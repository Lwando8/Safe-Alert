"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_TRANSITIONS_FOR_TEST = exports.ALLOWED_TRANSITIONS = void 0;
exports.isOperationalRequestStatus = isOperationalRequestStatus;
exports.canTransitionWorkOrder = canTransitionWorkOrder;
exports.ALLOWED_TRANSITIONS = {
    submitted: ['acknowledged', 'assigned', 'closed'],
    // After Accept (assigned → acknowledged), Start work: acknowledged → in_progress
    acknowledged: ['in_progress', 'assigned', 'awaiting_information', 'on_hold', 'closed'],
    // Responder "Accept" on a create-on-assign work order: assigned → acknowledged
    assigned: ['acknowledged', 'in_progress', 'awaiting_information', 'on_hold', 'closed'],
    in_progress: ['awaiting_information', 'on_hold', 'resolved', 'closed'],
    awaiting_information: ['in_progress', 'on_hold', 'assigned', 'closed'],
    on_hold: ['in_progress', 'assigned', 'awaiting_information', 'closed'],
    resolved: ['closed'],
    closed: [],
};
/** @deprecated Prefer ALLOWED_TRANSITIONS — kept for existing test imports */
exports.ALLOWED_TRANSITIONS_FOR_TEST = exports.ALLOWED_TRANSITIONS;
function isOperationalRequestStatus(value) {
    return typeof value === 'string' && value in exports.ALLOWED_TRANSITIONS;
}
function canTransitionWorkOrder(from, to) {
    const allowed = exports.ALLOWED_TRANSITIONS[from];
    if (!allowed)
        return false;
    return allowed.includes(to);
}
