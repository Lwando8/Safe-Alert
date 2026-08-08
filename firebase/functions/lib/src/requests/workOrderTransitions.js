"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_TRANSITIONS_FOR_TEST = void 0;
exports.canTransitionWorkOrder = canTransitionWorkOrder;
exports.ALLOWED_TRANSITIONS_FOR_TEST = {
    submitted: ['acknowledged', 'assigned', 'closed'],
    acknowledged: ['assigned', 'awaiting_information', 'on_hold', 'closed'],
    assigned: ['in_progress', 'awaiting_information', 'on_hold', 'closed'],
    in_progress: ['awaiting_information', 'on_hold', 'resolved', 'closed'],
    awaiting_information: ['in_progress', 'on_hold', 'assigned', 'closed'],
    on_hold: ['in_progress', 'assigned', 'awaiting_information', 'closed'],
    resolved: ['closed'],
    closed: [],
};
function canTransitionWorkOrder(from, to) {
    const allowed = exports.ALLOWED_TRANSITIONS_FOR_TEST[from];
    if (!allowed)
        return false;
    return allowed.includes(to);
}
