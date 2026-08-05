/**
 * Clerk path preflight — checks env readiness without claiming verification.
 *
 * Loads `firebase/functions/.env` and `apps/web/.env.local` when present.
 *
 * Usage:
 *   npm run preflight:clerk
 *
 * Exit codes:
 *   0 = ready (pk/sk + webhook signing secret — live checklist eligible)
 *   1 = keys_ready (pk/sk present; deploy functions, then add whsec_ and re-run)
 *   2 = externally_blocked (missing/placeholder Clerk pk/sk)
 */
import * as fs from 'fs';
import * as path from 'path';

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const raw of text.split(/\n/)) {
    const ln = raw.trim();
    if (!ln || ln.startsWith('#') || !ln.includes('=')) continue;
    const i = ln.indexOf('=');
    const key = ln.slice(0, i).trim();
    let value = ln.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

// scripts compile to lib/scripts/ → repo-relative paths
const functionsRoot = path.resolve(__dirname, '../..');
const repoRoot = path.resolve(functionsRoot, '../..');
loadEnvFile(path.join(functionsRoot, '.env'));
loadEnvFile(path.join(repoRoot, 'apps/web/.env.local'));

function isRealKey(value: string | undefined, prefixes: string[], placeholderNeedle: string): boolean {
  if (!value) return false;
  if (value.includes(placeholderNeedle) || value.includes('your_key') || value.includes('your_webhook')) {
    return false;
  }
  return prefixes.some(p => value.startsWith(p));
}

type Check = { id: string; ok: boolean; detail: string; requiredFor: 'keys' | 'webhook' };

function runClerkPreflight() {
  const checks: Check[] = [];

  const clerkSecret = process.env.CLERK_SECRET_KEY;
  const clerkPublishable =
    process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  const webPk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const webSk = process.env.CLERK_SECRET_KEY;

  checks.push({
    id: 'functions_clerk_secret',
    ok: isRealKey(clerkSecret, ['sk_'], 'your_key'),
    detail: clerkSecret
      ? isRealKey(clerkSecret, ['sk_'], 'your_key')
        ? 'CLERK_SECRET_KEY present'
        : 'CLERK_SECRET_KEY looks like a placeholder'
      : 'CLERK_SECRET_KEY missing',
    requiredFor: 'keys',
  });

  checks.push({
    id: 'functions_or_web_publishable',
    ok: isRealKey(clerkPublishable, ['pk_'], 'your_key'),
    detail: clerkPublishable
      ? isRealKey(clerkPublishable, ['pk_'], 'your_key')
        ? 'Publishable key present'
        : 'Publishable key looks like a placeholder'
      : 'CLERK_PUBLISHABLE_KEY / NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY missing',
    requiredFor: 'keys',
  });

  checks.push({
    id: 'web_pair',
    ok: isRealKey(webPk, ['pk_'], 'your_key') && isRealKey(webSk, ['sk_'], 'your_key'),
    detail:
      isRealKey(webPk, ['pk_'], 'your_key') && isRealKey(webSk, ['sk_'], 'your_key')
        ? 'Web NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY ready'
        : 'Web Clerk key pair incomplete (set apps/web/.env.local)',
    requiredFor: 'keys',
  });

  checks.push({
    id: 'webhook_secret',
    ok: isRealKey(webhookSecret, ['whsec_'], 'your_webhook'),
    detail: webhookSecret
      ? isRealKey(webhookSecret, ['whsec_'], 'your_webhook')
        ? 'CLERK_WEBHOOK_SECRET present'
        : 'CLERK_WEBHOOK_SECRET looks like a placeholder'
      : 'CLERK_WEBHOOK_SECRET missing (set after functions deploy + Clerk webhook)',
    requiredFor: 'webhook',
  });

  const keysOk = checks.filter(c => c.requiredFor === 'keys').every(c => c.ok);
  const webhookOk = checks.filter(c => c.requiredFor === 'webhook').every(c => c.ok);
  const status = !keysOk ? 'externally_blocked' : webhookOk ? 'ready' : 'keys_ready';

  console.log('\n=== Clerk path preflight ===\n');
  for (const c of checks) {
    console.log(`${c.ok ? '✓' : '✗'} [${c.id}] ${c.detail}`);
  }
  console.log(`\nstatus: ${status}`);
  if (status === 'ready') {
    console.log(
      'Keys + webhook secret configured. Run docs/PHASE2B-MANUAL-VERIFICATION-CHECKLIST.md § Clerk path before claiming verification.\n'
    );
  } else if (status === 'keys_ready') {
    console.log(
      'Clerk pk/sk ready. Deploy functions, create Clerk webhook, set CLERK_WEBHOOK_SECRET, then re-run preflight.\n'
    );
  } else {
    console.log(
      'Clerk live path is externally blocked until real pk_/sk_ keys are provided. Do not claim Clerk verification.\n'
    );
  }

  console.log(
    JSON.stringify(
      {
        status,
        checks,
        next:
          status === 'ready'
            ? [
                'Confirm clerkWebhook URL in Clerk Dashboard',
                'Create University A/B orgs + memberships',
                'bootstrapOrganizationMemberships',
                'Run Clerk checklist and record evidence',
              ]
            : status === 'keys_ready'
              ? [
                  'firebase login (or FIREBASE_TOKEN) + set .firebaserc project',
                  'cd firebase/functions && npm run deploy',
                  'Clerk Dashboard → Webhooks → endpoint = clerkWebhook URL',
                  'Set CLERK_WEBHOOK_SECRET=whsec_... in functions env / secrets',
                  'npm run preflight:clerk  # expect status: ready',
                ]
              : [
                  'Copy apps/web/.env.local.example → .env.local with real pk_/sk_',
                  'Copy firebase/functions/.env.example → .env with real sk_',
                  'Re-run: npm run preflight:clerk',
                ],
      },
      null,
      2
    )
  );

  process.exit(status === 'ready' ? 0 : status === 'keys_ready' ? 1 : 2);
}

runClerkPreflight();
