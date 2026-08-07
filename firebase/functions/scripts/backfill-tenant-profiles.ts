/**
 * Backfill tenantProfile + default modules on existing organizations.
 * Additive only — never overwrites existing profile/module overrides.
 *
 * Usage (live):
 *   GCLOUD_PROJECT=seren-sos npm run backfill:tenant-profiles
 *
 * Usage (emulator):
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-seren \
 *     npm run backfill:tenant-profiles
 *
 * Safe to re-run: orgs that already have tenantProfile + settings.modules are skipped.
 * Dry run: BACKFILL_DRY_RUN=1 npm run backfill:tenant-profiles
 */
import * as admin from 'firebase-admin';
import { buildOrganizationTenantDefaults } from '../src/services/tenantConfig';

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-seren';

if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}

const db = admin.firestore();

async function run() {
  const dryRun = process.env.BACKFILL_DRY_RUN === '1' || process.env.BACKFILL_DRY_RUN === 'true';
  const defaults = buildOrganizationTenantDefaults('UNIVERSITY');
  const snap = await db.collection('organizations').get();
  let updated = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data() as Record<string, unknown>;
    const settings =
      data.settings && typeof data.settings === 'object'
        ? (data.settings as Record<string, unknown>)
        : {};

    const hasProfile = typeof data.tenantProfile === 'string';
    const hasModules = settings.modules && typeof settings.modules === 'object';

    if (hasProfile && hasModules) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] would backfill organization ${doc.id}`);
      updated += 1;
      continue;
    }

    await doc.ref.set(
      {
        tenantProfile: data.tenantProfile || defaults.tenantProfile,
        settings: {
          ...settings,
          modules: settings.modules || defaults.settings.modules,
          terminology: settings.terminology || defaults.settings.terminology,
          operationalCategories:
            settings.operationalCategories || defaults.settings.operationalCategories,
          communityAlertCategories:
            settings.communityAlertCategories || defaults.settings.communityAlertCategories,
        },
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    updated += 1;
    console.log(`Backfilled organization ${doc.id}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        projectId,
        emulator: !!process.env.FIRESTORE_EMULATOR_HOST,
        scanned: snap.size,
        updated,
        skipped,
      },
      null,
      2
    )
  );
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
