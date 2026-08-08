import { describe, expect, it } from 'vitest';
import {
  canAccessFacilitiesWorkOrders,
  canAccessIncidentJobs,
  resolveResponderBranchVisibility,
} from '../services/responderBranches';

describe('responderBranches — security vs facilities UI gates', () => {
  it('security-only sees incident jobs, not work orders', () => {
    const caps = ['INCIDENT_RESPONSE', 'PATROL'];
    expect(canAccessIncidentJobs(caps)).toBe(true);
    expect(canAccessFacilitiesWorkOrders(caps)).toBe(false);
    expect(resolveResponderBranchVisibility(caps)).toEqual({
      showIncidentJobs: true,
      showWorkOrders: false,
    });
  });

  it('facilities-only sees work orders, not incident jobs', () => {
    const caps = ['GENERAL_MAINTENANCE', 'PLUMBING'];
    expect(canAccessIncidentJobs(caps)).toBe(false);
    expect(canAccessFacilitiesWorkOrders(caps)).toBe(true);
    expect(resolveResponderBranchVisibility(caps)).toEqual({
      showIncidentJobs: false,
      showWorkOrders: true,
    });
  });

  it('hybrid lab dual-cap sees both surfaces', () => {
    const caps = ['INCIDENT_RESPONSE', 'PATROL', 'GENERAL_MAINTENANCE'];
    expect(resolveResponderBranchVisibility(caps)).toEqual({
      showIncidentJobs: true,
      showWorkOrders: true,
    });
  });

  it('empty capabilities fail open to incident jobs only', () => {
    expect(resolveResponderBranchVisibility([])).toEqual({
      showIncidentJobs: true,
      showWorkOrders: false,
    });
  });
});
