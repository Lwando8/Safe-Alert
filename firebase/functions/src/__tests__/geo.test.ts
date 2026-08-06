import { describe, expect, it } from 'vitest';
import {
  clampRadiusKm,
  filterIncidentsByRadius,
  haversineKm,
  readLatLng,
} from '../services/geo';

describe('geo helpers', () => {
  it('computes haversine distance for nearby points', () => {
    const a = { latitude: -26.2041, longitude: 28.0473 };
    const b = { latitude: -26.2051, longitude: 28.0483 };
    const km = haversineKm(a, b);
    expect(km).toBeGreaterThan(0);
    expect(km).toBeLessThan(1);
  });

  it('clamps radius into safe bounds', () => {
    expect(clampRadiusKm(undefined)).toBe(25);
    expect(clampRadiusKm(0)).toBe(0.1);
    expect(clampRadiusKm(999)).toBe(50);
    expect(clampRadiusKm(10)).toBe(10);
  });

  it('reads lat/lng aliases and rejects invalid coords', () => {
    expect(readLatLng({ lat: 1, lng: 2 })).toEqual({ latitude: 1, longitude: 2 });
    expect(readLatLng({ latitude: 91, longitude: 0 })).toBeNull();
    expect(readLatLng({})).toBeNull();
  });

  it('filters incidents by radius and prefers lastLocation', () => {
    const center = { latitude: 0, longitude: 0 };
    const incidents = [
      {
        id: 'near',
        location: { latitude: 0.01, longitude: 0 },
      },
      {
        id: 'far',
        location: { latitude: 10, longitude: 10 },
      },
      {
        id: 'moved-near',
        location: { latitude: 10, longitude: 10 },
        lastLocation: { latitude: 0.02, longitude: 0 },
      },
      { id: 'nocoords' },
    ];
    const filtered = filterIncidentsByRadius(incidents, center, 5);
    expect(filtered.map(i => i.id)).toEqual(['near', 'moved-near']);
    expect(filtered[0]!.distanceKm).toBeLessThan(filtered[1]!.distanceKm);
  });
});
