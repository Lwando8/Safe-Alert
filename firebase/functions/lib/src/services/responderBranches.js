"use strict";
/**
 * Pure capability → UI branch helpers (mirrors mobile `src/auth/responderBranches.ts`).
 * Kept under functions so CI vitest does not import Expo root tsconfig.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCapabilityList = normalizeCapabilityList;
exports.canAccessIncidentJobs = canAccessIncidentJobs;
exports.canAccessFacilitiesWorkOrders = canAccessFacilitiesWorkOrders;
exports.resolveResponderBranchVisibility = resolveResponderBranchVisibility;
const INCIDENT_CAPS = new Set([
    'INCIDENT_RESPONSE',
    'PATROL',
    'ACCESS_CONTROL',
]);
const FACILITIES_CAPS = new Set([
    'GENERAL_MAINTENANCE',
    'PLUMBING',
    'ELECTRICAL',
    'CLEANING',
    'IT_SUPPORT',
]);
function normalizeCapabilityList(capabilities) {
    if (!Array.isArray(capabilities))
        return [];
    return capabilities.map(c => String(c).trim()).filter(Boolean);
}
function canAccessIncidentJobs(capabilities) {
    const caps = normalizeCapabilityList(capabilities);
    if (caps.length === 0)
        return true;
    return caps.some(c => INCIDENT_CAPS.has(c));
}
function canAccessFacilitiesWorkOrders(capabilities) {
    const caps = normalizeCapabilityList(capabilities);
    return caps.some(c => FACILITIES_CAPS.has(c));
}
function resolveResponderBranchVisibility(capabilities) {
    const showIncidentJobs = canAccessIncidentJobs(capabilities);
    const showWorkOrders = canAccessFacilitiesWorkOrders(capabilities);
    if (!showIncidentJobs && !showWorkOrders) {
        return { showIncidentJobs: true, showWorkOrders: false };
    }
    return { showIncidentJobs, showWorkOrders };
}
