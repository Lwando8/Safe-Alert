import { describe, expect, it } from 'vitest';
import {
  canHandleRequestCategory,
  canRespondToIncident,
  defaultCapabilitiesForResponderType,
  defaultCapabilitiesForTeamKind,
  normalizeResponderType,
  requiredCapabilitiesForRequestCategory,
  resolveEffectiveCapabilities,
} from '../services/responderCapabilities';

describe('Phase D responder capabilities', () => {
  it('aliases campus_security to SECURITY defaults with INCIDENT_RESPONSE', () => {
    expect(normalizeResponderType('campus_security')).toBe('SECURITY');
    expect(defaultCapabilitiesForResponderType('campus_security')).toContain(
      'INCIDENT_RESPONSE'
    );
    expect(canRespondToIncident({ responderType: 'campus_security' })).toBe(true);
  });

  it('keeps maintenance units off emergency incidents', () => {
    expect(defaultCapabilitiesForResponderType('MAINTENANCE')).toEqual([
      'GENERAL_MAINTENANCE',
    ]);
    expect(canRespondToIncident({ responderType: 'MAINTENANCE' })).toBe(false);
    expect(
      canRespondToIncident({
        capabilities: ['GENERAL_MAINTENANCE', 'PLUMBING'],
        responderType: 'FACILITIES',
      })
    ).toBe(false);
  });

  it('honours explicit capabilities over type defaults', () => {
    expect(
      resolveEffectiveCapabilities({
        capabilities: ['PLUMBING'],
        responderType: 'campus_security',
      })
    ).toEqual(['PLUMBING']);
    expect(
      canRespondToIncident({
        capabilities: ['PLUMBING'],
        responderType: 'campus_security',
      })
    ).toBe(false);
  });

  it('maps request categories to maintenance capabilities', () => {
    expect(requiredCapabilitiesForRequestCategory('plumbing')).toEqual([
      'PLUMBING',
      'GENERAL_MAINTENANCE',
    ]);
    expect(
      canHandleRequestCategory({
        membershipKind: 'facilities',
        category: 'plumbing',
      })
    ).toBe(true);
    expect(
      canHandleRequestCategory({
        membershipKind: 'security_guard',
        category: 'plumbing',
      })
    ).toBe(false);
    expect(
      canHandleRequestCategory({
        capabilities: ['INCIDENT_RESPONSE', 'PATROL'],
        category: 'electrical',
      })
    ).toBe(false);
  });

  it('allows facilities teams for general ops categories', () => {
    const caps = defaultCapabilitiesForTeamKind('facilities');
    expect(caps).toContain('GENERAL_MAINTENANCE');
    expect(
      canHandleRequestCategory({
        capabilities: caps,
        teamKind: 'facilities',
        category: 'general_facilities',
      })
    ).toBe(true);
    expect(
      canHandleRequestCategory({
        capabilities: defaultCapabilitiesForTeamKind('security'),
        teamKind: 'security',
        category: 'plumbing',
      })
    ).toBe(false);
  });

  it('falls back to membership kind when unit type unknown', () => {
    expect(
      canRespondToIncident({
        membershipKind: 'security_guard',
      })
    ).toBe(true);
    expect(
      canHandleRequestCategory({
        membershipKind: 'facilities',
        category: 'it',
      })
    ).toBe(true);
  });
});
