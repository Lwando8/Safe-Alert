import { describe, expect, it } from 'vitest';
import {
  canUseResponderExperience,
  canUseUserExperience,
  resolveMobileExperience,
} from '../services/experienceRouting';

describe('mobile experience routing', () => {
  it('routes student-only to user', () => {
    expect(
      resolveMobileExperience({
        membershipStatus: 'active',
        role: 'student',
        permissions: ['requests:create'],
        capabilities: [],
      })
    ).toBe('user');
  });

  it('routes security_guard to responder', () => {
    expect(
      resolveMobileExperience({
        membershipStatus: 'active',
        role: 'security_guard',
        permissions: ['incidents:acknowledge'],
        capabilities: ['INCIDENT_RESPONSE'],
      })
    ).toBe('responder');
  });

  it('dual-capable without unitId prefers last experience then responder', () => {
    const both = {
      membershipStatus: 'active' as const,
      role: 'security_guard',
      permissions: ['requests:create', 'incidents:acknowledge'],
      capabilities: ['INCIDENT_RESPONSE'],
    };
    expect(resolveMobileExperience({ ...both, lastExperience: 'user' })).toBe('user');
    expect(resolveMobileExperience({ ...both, lastExperience: 'responder' })).toBe('responder');
    expect(resolveMobileExperience(both)).toBe('responder');
  });

  it('dual-capable with unitId prefers responder over stale lastExperience=user', () => {
    expect(
      resolveMobileExperience({
        membershipStatus: 'active',
        role: 'security_guard',
        permissions: ['incidents:acknowledge'],
        capabilities: ['INCIDENT_RESPONSE'],
        unitId: 'ALPHA-12',
        lastExperience: 'user',
      })
    ).toBe('responder');
  });

  it('pending / revoked yield none', () => {
    expect(
      resolveMobileExperience({ membershipStatus: 'invited', role: 'student' })
    ).toBe('none');
    expect(
      resolveMobileExperience({ membershipStatus: 'revoked', role: 'security_guard' })
    ).toBe('none');
  });

  it('does not infer from email — only membership fields', () => {
    expect(canUseResponderExperience({ role: 'student', permissions: [] })).toBe(false);
    expect(canUseUserExperience({ role: 'student', membershipStatus: 'active' })).toBe(true);
  });
});
