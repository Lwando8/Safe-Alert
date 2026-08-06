"use strict";
/**
 * Pure geo helpers — unit-testable without Firestore.
 * Ported from legacy server/lib/geo.js for Cloud Functions use.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.haversineKm = haversineKm;
exports.clampRadiusKm = clampRadiusKm;
exports.readLatLng = readLatLng;
exports.incidentPoint = incidentPoint;
exports.filterIncidentsByRadius = filterIncidentsByRadius;
function haversineKm(a, b) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    return 2 * R * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
/** Clamp radius to a safe operational range (km). */
function clampRadiusKm(radiusKm, fallback = 25) {
    const n = typeof radiusKm === 'number' ? radiusKm : Number(radiusKm);
    if (!Number.isFinite(n))
        return fallback;
    return Math.min(50, Math.max(0.1, n));
}
function readLatLng(value) {
    if (!value || typeof value !== 'object')
        return null;
    const v = value;
    const latitude = typeof v.latitude === 'number'
        ? v.latitude
        : typeof v.lat === 'number'
            ? v.lat
            : null;
    const longitude = typeof v.longitude === 'number'
        ? v.longitude
        : typeof v.lng === 'number'
            ? v.lng
            : null;
    if (latitude === null ||
        longitude === null ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)) {
        return null;
    }
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180)
        return null;
    return { latitude, longitude };
}
function incidentPoint(incident) {
    return readLatLng(incident.lastLocation) || readLatLng(incident.location);
}
function filterIncidentsByRadius(incidents, center, radiusKm) {
    const out = [];
    for (const incident of incidents) {
        const point = incidentPoint(incident);
        if (!point)
            continue;
        const distanceKm = haversineKm(center, point);
        if (distanceKm <= radiusKm) {
            out.push({ ...incident, distanceKm });
        }
    }
    out.sort((a, b) => a.distanceKm - b.distanceKm);
    return out;
}
