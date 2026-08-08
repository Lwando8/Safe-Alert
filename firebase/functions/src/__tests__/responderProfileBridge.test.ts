import { describe, expect, it } from 'vitest';
import {
  buildClerkCompatResponderProfile,
  resolveAuthoritativeUnitCode,
  shouldPersistClerkResponderProfile,
} from '../../../../src/services/responderProfileBridge';

describe('responderProfileBridge — Clerk → ResponderProfile', () => {
  it('persists only for authoritative responder + unit', () => {
    expect(
      shouldPersistClerkResponderProfile({
        experience: 'responder',
        canUseResponderExperience: true,
        unitCode: 'UNIT-A1',
      })
    ).toBe(true);
  });

  it('does not persist for user-only experience', () => {
    expect(
      shouldPersistClerkResponderProfile({
        experience: 'user',
        canUseResponderExperience: false,
        unitCode: 'UNIT-A1',
      })
    ).toBe(false);
  });

  it('does not persist when canUseResponderExperience is false', () => {
    expect(
      shouldPersistClerkResponderProfile({
        experience: 'responder',
        canUseResponderExperience: false,
        unitCode: 'UNIT-A1',
      })
    ).toBe(false);
  });

  it('fails closed when unit context is missing', () => {
    expect(
      shouldPersistClerkResponderProfile({
        experience: 'responder',
        canUseResponderExperience: true,
        unitCode: null,
      })
    ).toBe(false);
    expect(resolveAuthoritativeUnitCode({ sessionUnitId: null, compatUnit: null })).toBe(null);
    expect(resolveAuthoritativeUnitCode({ sessionUnitId: '', compatUnit: null })).toBe(null);
    expect(
      resolveAuthoritativeUnitCode({ sessionUnitId: 'CLERK-abc12345', compatUnit: null })
    ).toBe(null);
  });

  it('prefers Express compat unit over session unitId', () => {
    expect(
      resolveAuthoritativeUnitCode({
        sessionUnitId: 'SESSION-UNIT',
        compatUnit: { unitCode: 'EXPRESS-UNIT', id: 'u1', responderType: 'medical' },
      })
    ).toBe('EXPRESS-UNIT');
  });

  it('uses PlatformSession unitId when Express unit record is absent', () => {
    expect(
      resolveAuthoritativeUnitCode({
        sessionUnitId: 'GUARDS-01',
        compatUnit: null,
      })
    ).toBe('GUARDS-01');
  });

  it('builds minimal ResponderProfile from session unit + optional Express unit', () => {
    const fromSession = buildClerkCompatResponderProfile({
      personId: 'user_abc',
      unitCode: 'GUARDS-01',
      organizationId: 'university-a',
      compatUnit: null,
    });
    expect(fromSession).toEqual({
      id: 'GUARDS-01',
      unitCode: 'GUARDS-01',
      name: 'GUARDS-01',
      role: 'community_patrol',
      organizationId: 'university-a',
      providerId: 'university-a',
      vehicleRegistration: null,
      status: 'available',
    });

    const fromExpress = buildClerkCompatResponderProfile({
      personId: 'user_abc',
      unitCode: 'GUARDS-01',
      organizationId: 'university-a',
      compatUnit: {
        id: 'unit_db_1',
        unitCode: 'GUARDS-01',
        responderType: 'armed_response',
        organizationId: 'university-a',
        vehicleRegistration: 'ABC123',
        status: 'available',
      },
    });
    expect(fromExpress.id).toBe('unit_db_1');
    expect(fromExpress.role).toBe('armed_response');
    expect(fromExpress.vehicleRegistration).toBe('ABC123');
  });
});
