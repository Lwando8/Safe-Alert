"use strict";
/**
 * Privacy helpers for Community Alerts / Missing Pet.
 * Never auto-expose email, phone, or private residence from profile/details.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeCommunityAlertPublic = sanitizeCommunityAlertPublic;
exports.sanitizeSightingPublic = sanitizeSightingPublic;
const FORBIDDEN_DETAIL_KEYS = new Set([
    'email',
    'phone',
    'phoneNumber',
    'mobile',
    'homeAddress',
    'address',
    'privateResidence',
    'residenceAddress',
    'contactEmail',
    'contactPhone',
]);
function sanitizeCommunityAlertPublic(alert) {
    const details = alert.details && typeof alert.details === 'object'
        ? stripForbiddenKeys(alert.details)
        : {};
    const out = {
        ...alert,
        details,
    };
    // Never leak nested PII bags
    delete out.email;
    delete out.phone;
    delete out.phoneNumber;
    delete out.homeAddress;
    return out;
}
function sanitizeSightingPublic(sighting) {
    const out = { ...sighting };
    delete out.email;
    delete out.phone;
    delete out.phoneNumber;
    delete out.homeAddress;
    // Location label is allowed; private residence flag must be explicit and not auto-set
    if (out.isPrivateResidence === true && !out.locationLabel) {
        out.locationLabel = 'Private location (withheld)';
        out.location = null;
    }
    return out;
}
function stripForbiddenKeys(details) {
    const out = {};
    for (const [key, value] of Object.entries(details)) {
        if (FORBIDDEN_DETAIL_KEYS.has(key))
            continue;
        if (key.toLowerCase().includes('email') || key.toLowerCase().includes('phone'))
            continue;
        out[key] = value;
    }
    // Missing pet allowlist-ish enrichment
    const allowedPet = [
        'petName',
        'petType',
        'breed',
        'color',
        'description',
        'lastSeenAt',
        'lastSeenLabel',
        'microchip',
        'distinctiveMarks',
    ];
    // Keep non-forbidden keys; prefer known pet fields when present
    for (const k of allowedPet) {
        if (k in details && !FORBIDDEN_DETAIL_KEYS.has(k)) {
            out[k] = details[k];
        }
    }
    return out;
}
