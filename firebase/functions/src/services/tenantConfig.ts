/**
 * Tenant profiles, modules, and effective configuration helpers.
 * Profiles supply defaults; organization.settings overrides win.
 * Never trust client-supplied module claims for authorization.
 */

export type TenantProfile =
  | 'UNIVERSITY'
  | 'RESIDENTIAL'
  | 'BUSINESS_PARK'
  | 'CORPORATE_CAMPUS'
  | 'STUDENT_RESIDENCE'
  | 'GENERAL_COMMUNITY';

export const TENANT_PROFILES: readonly TenantProfile[] = [
  'UNIVERSITY',
  'RESIDENTIAL',
  'BUSINESS_PARK',
  'CORPORATE_CAMPUS',
  'STUDENT_RESIDENCE',
  'GENERAL_COMMUNITY',
] as const;

export type PlatformModule =
  | 'SAFETY'
  | 'OPERATIONS'
  | 'COMMUNITY'
  | 'GROUPS'
  | 'EVENTS'
  | 'COMMUNITY_ALERTS'
  | 'RIDE_SAFETY'
  | 'BROADCASTS'
  | 'ANALYTICS';

export const PLATFORM_MODULES: readonly PlatformModule[] = [
  'SAFETY',
  'OPERATIONS',
  'COMMUNITY',
  'GROUPS',
  'EVENTS',
  'COMMUNITY_ALERTS',
  'RIDE_SAFETY',
  'BROADCASTS',
  'ANALYTICS',
] as const;

export type ModuleFlags = Record<PlatformModule, boolean>;

export type OperationalCategoryId =
  | 'plumbing'
  | 'water_leak'
  | 'electrical'
  | 'lighting'
  | 'building_maintenance'
  | 'infrastructure_damage'
  | 'roads'
  | 'cleaning'
  | 'waste'
  | 'landscaping'
  | 'parking'
  | 'general_facilities'
  | 'asset_damage'
  | 'it'
  | 'other';

export interface OperationalCategoryDef {
  id: OperationalCategoryId | string;
  label: string;
  active: boolean;
}

export type CommunityAlertCategoryId =
  | 'MISSING_PET'
  | 'FOUND_PET'
  | 'LOST_PROPERTY'
  | 'FOUND_PROPERTY'
  | 'COMMUNITY_ASSISTANCE'
  | 'NOTICE';

export interface CommunityAlertCategoryDef {
  id: CommunityAlertCategoryId;
  label: string;
  active: boolean;
}

export interface TerminologyPack {
  organization: string;
  site: string;
  zone: string;
  member: string;
  responder: string;
  incident: string;
  request: string;
}

export interface OrganizationModuleSettings {
  modules?: Partial<ModuleFlags>;
  operationalCategories?: OperationalCategoryDef[];
  communityAlertCategories?: CommunityAlertCategoryDef[];
  terminology?: Partial<TerminologyPack>;
}

const DEFAULT_OPERATIONAL_CATEGORIES: OperationalCategoryDef[] = [
  { id: 'plumbing', label: 'Plumbing', active: true },
  { id: 'water_leak', label: 'Water leak', active: true },
  { id: 'electrical', label: 'Electrical fault', active: true },
  { id: 'lighting', label: 'Streetlight / lighting', active: true },
  { id: 'building_maintenance', label: 'Building maintenance', active: true },
  { id: 'infrastructure_damage', label: 'Infrastructure damage', active: true },
  { id: 'roads', label: 'Roads / potholes', active: true },
  { id: 'cleaning', label: 'Cleaning', active: true },
  { id: 'waste', label: 'Waste', active: true },
  { id: 'landscaping', label: 'Landscaping / grounds', active: true },
  { id: 'parking', label: 'Parking issue', active: true },
  { id: 'general_facilities', label: 'General facilities', active: true },
  { id: 'asset_damage', label: 'Asset damage', active: true },
  { id: 'it', label: 'IT issue', active: true },
  { id: 'other', label: 'Other operational request', active: true },
];

const DEFAULT_COMMUNITY_ALERT_CATEGORIES: CommunityAlertCategoryDef[] = [
  { id: 'MISSING_PET', label: 'Missing Pet', active: true },
  { id: 'FOUND_PET', label: 'Found Pet', active: true },
  { id: 'LOST_PROPERTY', label: 'Lost Property', active: true },
  { id: 'FOUND_PROPERTY', label: 'Found Property', active: true },
  { id: 'COMMUNITY_ASSISTANCE', label: 'Community Assistance', active: true },
  { id: 'NOTICE', label: 'Local Community Notice', active: true },
];

function allModules(value: boolean): ModuleFlags {
  return {
    SAFETY: value,
    OPERATIONS: value,
    COMMUNITY: value,
    GROUPS: value,
    EVENTS: value,
    COMMUNITY_ALERTS: value,
    RIDE_SAFETY: value,
    BROADCASTS: value,
    ANALYTICS: value,
  };
}

const PROFILE_MODULE_DEFAULTS: Record<TenantProfile, ModuleFlags> = {
  UNIVERSITY: {
    ...allModules(true),
  },
  RESIDENTIAL: {
    ...allModules(true),
    RIDE_SAFETY: false,
  },
  BUSINESS_PARK: {
    ...allModules(true),
    RIDE_SAFETY: false,
    COMMUNITY_ALERTS: true,
  },
  CORPORATE_CAMPUS: {
    ...allModules(true),
    RIDE_SAFETY: false,
  },
  STUDENT_RESIDENCE: {
    ...allModules(true),
  },
  GENERAL_COMMUNITY: {
    ...allModules(true),
    RIDE_SAFETY: false,
  },
};

const PROFILE_TERMINOLOGY: Record<TenantProfile, TerminologyPack> = {
  UNIVERSITY: {
    organization: 'University',
    site: 'Campus',
    zone: 'Zone',
    member: 'Member',
    responder: 'Responder',
    incident: 'Incident',
    request: 'Request',
  },
  RESIDENTIAL: {
    organization: 'Estate',
    site: 'Precinct',
    zone: 'Area',
    member: 'Resident',
    responder: 'Responder',
    incident: 'Incident',
    request: 'Maintenance request',
  },
  BUSINESS_PARK: {
    organization: 'Business park',
    site: 'Campus',
    zone: 'Zone',
    member: 'Member',
    responder: 'Responder',
    incident: 'Incident',
    request: 'Facilities request',
  },
  CORPORATE_CAMPUS: {
    organization: 'Campus',
    site: 'Site',
    zone: 'Zone',
    member: 'Employee',
    responder: 'Responder',
    incident: 'Incident',
    request: 'Facilities request',
  },
  STUDENT_RESIDENCE: {
    organization: 'Residence',
    site: 'Building',
    zone: 'Floor',
    member: 'Resident',
    responder: 'Responder',
    incident: 'Incident',
    request: 'Request',
  },
  GENERAL_COMMUNITY: {
    organization: 'Community',
    site: 'Area',
    zone: 'Zone',
    member: 'Member',
    responder: 'Responder',
    incident: 'Incident',
    request: 'Request',
  },
};

export function isTenantProfile(value: unknown): value is TenantProfile {
  return typeof value === 'string' && (TENANT_PROFILES as readonly string[]).includes(value);
}

export function isPlatformModule(value: unknown): value is PlatformModule {
  return typeof value === 'string' && (PLATFORM_MODULES as readonly string[]).includes(value);
}

export function defaultModulesForProfile(profile: TenantProfile): ModuleFlags {
  return { ...PROFILE_MODULE_DEFAULTS[profile] };
}

export function defaultTerminologyForProfile(profile: TenantProfile): TerminologyPack {
  return { ...PROFILE_TERMINOLOGY[profile] };
}

export function defaultOperationalCategories(): OperationalCategoryDef[] {
  return DEFAULT_OPERATIONAL_CATEGORIES.map(c => ({ ...c }));
}

export function defaultCommunityAlertCategories(
  profile: TenantProfile
): CommunityAlertCategoryDef[] {
  const cats = DEFAULT_COMMUNITY_ALERT_CATEGORIES.map(c => ({ ...c }));
  if (profile === 'UNIVERSITY') {
    // Pets optional for universities — default off unless enabled
    return cats.map(c =>
      c.id === 'MISSING_PET' || c.id === 'FOUND_PET' ? { ...c, active: false } : c
    );
  }
  return cats;
}

export function resolveEffectiveModules(
  profile: TenantProfile,
  overrides?: Partial<ModuleFlags> | null
): ModuleFlags {
  const base = defaultModulesForProfile(profile);
  if (!overrides) return base;
  const out = { ...base };
  for (const key of PLATFORM_MODULES) {
    if (typeof overrides[key] === 'boolean') {
      out[key] = overrides[key]!;
    }
  }
  return out;
}

export function isModuleEnabled(
  profile: TenantProfile,
  module: PlatformModule,
  overrides?: Partial<ModuleFlags> | null
): boolean {
  return resolveEffectiveModules(profile, overrides)[module] === true;
}

export function resolveTerminology(
  profile: TenantProfile,
  overrides?: Partial<TerminologyPack> | null
): TerminologyPack {
  return { ...defaultTerminologyForProfile(profile), ...(overrides || {}) };
}

export function resolveOperationalCategories(
  overrides?: OperationalCategoryDef[] | null
): OperationalCategoryDef[] {
  if (overrides && overrides.length) return overrides.map(c => ({ ...c }));
  return defaultOperationalCategories();
}

export function resolveCommunityAlertCategories(
  profile: TenantProfile,
  overrides?: CommunityAlertCategoryDef[] | null
): CommunityAlertCategoryDef[] {
  if (overrides && overrides.length) return overrides.map(c => ({ ...c }));
  return defaultCommunityAlertCategories(profile);
}

/** Payload to stamp on new/backfilled organization documents. */
export function buildOrganizationTenantDefaults(profile: TenantProfile = 'UNIVERSITY'): {
  tenantProfile: TenantProfile;
  settings: {
    modules: ModuleFlags;
    operationalCategories: OperationalCategoryDef[];
    communityAlertCategories: CommunityAlertCategoryDef[];
    terminology: TerminologyPack;
  };
} {
  return {
    tenantProfile: profile,
    settings: {
      modules: defaultModulesForProfile(profile),
      operationalCategories: defaultOperationalCategories(),
      communityAlertCategories: defaultCommunityAlertCategories(profile),
      terminology: defaultTerminologyForProfile(profile),
    },
  };
}

/**
 * Phase G — apply profile pack when vertical changes.
 */
export function applyTenantProfilePack(input: {
  profile: TenantProfile;
  restampDefaults?: boolean;
  existingSettings?: OrganizationModuleSettings | null;
  modulesOverride?: Partial<ModuleFlags> | null;
  terminologyOverride?: Partial<TerminologyPack> | null;
  operationalCategoriesOverride?: OperationalCategoryDef[] | null;
  communityAlertCategoriesOverride?: CommunityAlertCategoryDef[] | null;
}): OrganizationModuleSettings {
  const pack = buildOrganizationTenantDefaults(input.profile).settings;
  const restamp = input.restampDefaults === true;

  const modules = resolveEffectiveModules(
    input.profile,
    restamp
      ? input.modulesOverride || null
      : {
          ...(input.existingSettings?.modules || {}),
          ...(input.modulesOverride || {}),
        }
  );

  const terminology = resolveTerminology(
    input.profile,
    restamp
      ? input.terminologyOverride || null
      : {
          ...(input.existingSettings?.terminology || {}),
          ...(input.terminologyOverride || {}),
        }
  );

  const operationalCategories = input.operationalCategoriesOverride?.length
    ? input.operationalCategoriesOverride.map(c => ({ ...c }))
    : restamp || !input.existingSettings?.operationalCategories?.length
      ? pack.operationalCategories
      : input.existingSettings.operationalCategories.map(c => ({ ...c }));

  const communityAlertCategories = input.communityAlertCategoriesOverride?.length
    ? input.communityAlertCategoriesOverride.map(c => ({ ...c }))
    : restamp || !input.existingSettings?.communityAlertCategories?.length
      ? pack.communityAlertCategories
      : input.existingSettings.communityAlertCategories.map(c => ({ ...c }));

  return {
    modules,
    terminology,
    operationalCategories,
    communityAlertCategories,
  };
}
