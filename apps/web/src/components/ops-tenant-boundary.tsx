'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth, useOrganization } from '@clerk/nextjs';
import { isClerkPublishableConfigured } from '@/lib/auth-guards';

type OpsTenantBoundaryValue = {
  /** Stable key for the active Clerk organization (or signed-out sentinel). */
  activeOrgKey: string;
  /** Increments on org switch or sign-out so consumers remount and drop caches. */
  tenantEpoch: number;
  isSignedIn: boolean;
  clerkEnabled: boolean;
};

const OpsTenantBoundaryContext = createContext<OpsTenantBoundaryValue>({
  activeOrgKey: 'none',
  tenantEpoch: 0,
  isSignedIn: false,
  clerkEnabled: false,
});

export function useOpsTenantBoundary(): OpsTenantBoundaryValue {
  return useContext(OpsTenantBoundaryContext);
}

/**
 * Wraps university ops children so org-switch / sign-out remounts the tree
 * and clears any tenant-scoped client state (shells + incidents).
 */
export function OpsTenantBoundary({ children }: { children: ReactNode }) {
  const clerkEnabled = isClerkPublishableConfigured();

  if (!clerkEnabled) {
    return (
      <OpsTenantBoundaryContext.Provider
        value={{
          activeOrgKey: 'clerk_unconfigured',
          tenantEpoch: 0,
          isSignedIn: false,
          clerkEnabled: false,
        }}
      >
        <div data-ops-tenant-key="clerk_unconfigured" data-tenant-epoch={0}>
          {children}
        </div>
      </OpsTenantBoundaryContext.Provider>
    );
  }

  return <OpsTenantBoundaryAuthed>{children}</OpsTenantBoundaryAuthed>;
}

function OpsTenantBoundaryAuthed({ children }: { children: ReactNode }) {
  const { isSignedIn, orgId, orgSlug } = useAuth();
  const { organization } = useOrganization();
  const activeOrgKey = !isSignedIn
    ? 'signed_out'
    : orgSlug || organization?.slug || orgId || 'none';

  const [tenantEpoch, setTenantEpoch] = useState(0);
  const [prevKey, setPrevKey] = useState(activeOrgKey);

  useEffect(() => {
    if (activeOrgKey !== prevKey) {
      setPrevKey(activeOrgKey);
      setTenantEpoch(e => e + 1);
    }
  }, [activeOrgKey, prevKey]);

  const value = useMemo(
    () => ({
      activeOrgKey,
      tenantEpoch,
      isSignedIn: !!isSignedIn,
      clerkEnabled: true,
    }),
    [activeOrgKey, tenantEpoch, isSignedIn],
  );

  return (
    <OpsTenantBoundaryContext.Provider value={value}>
      {/* Key forces full remount of ops page trees on org switch / sign-out */}
      <div
        key={`${activeOrgKey}:${tenantEpoch}`}
        data-ops-tenant-key={activeOrgKey}
        data-tenant-epoch={tenantEpoch}
      >
        {children}
      </div>
    </OpsTenantBoundaryContext.Provider>
  );
}

/** Contract covered by incidents client + this boundary (Phase 2C). */
export const OPS_TENANT_CACHE_CONTRACT = [
  'sign_out_clears_incidents',
  'org_switch_invalidates_query',
  'unauthorized_hides_prior_data',
  'ops_shells_remount_on_tenant_epoch',
] as const;
