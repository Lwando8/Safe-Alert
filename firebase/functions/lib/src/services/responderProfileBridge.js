"use strict";
/**
 * Pure Clerk → ResponderProfile helpers (mirrors mobile `src/services/responderProfileBridge.ts`).
 * Kept under functions so CI vitest does not import Expo root tsconfig.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAuthoritativeUnitCode = resolveAuthoritativeUnitCode;
exports.shouldPersistClerkResponderProfile = shouldPersistClerkResponderProfile;
exports.buildClerkCompatResponderProfile = buildClerkCompatResponderProfile;
/** Authoritative unit code only — never invent CLERK-* synthetics. */
function resolveAuthoritativeUnitCode(input) {
    const fromCompat = String(input.compatUnit?.unitCode || '').trim();
    if (fromCompat)
        return fromCompat;
    const fromSession = String(input.sessionUnitId || '').trim();
    if (!fromSession)
        return null;
    if (/^CLERK-/i.test(fromSession))
        return null;
    return fromSession;
}
function shouldPersistClerkResponderProfile(input) {
    if (input.experience !== 'responder')
        return false;
    if (!input.canUseResponderExperience)
        return false;
    if (!input.unitCode)
        return false;
    return true;
}
function buildClerkCompatResponderProfile(input) {
    const unit = input.compatUnit;
    const unitCode = String(unit?.unitCode || input.unitCode).trim();
    const organizationId = unit?.organizationId ?? input.organizationId ?? null;
    return {
        id: String(unit?.id || unitCode),
        unitCode,
        name: unitCode,
        role: typeof unit?.responderType === 'string' ? unit.responderType : 'community_patrol',
        organizationId,
        providerId: organizationId,
        vehicleRegistration: unit?.vehicleRegistration ?? null,
        status: typeof unit?.status === 'string' ? unit.status : 'available',
    };
}
