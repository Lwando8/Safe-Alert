"use strict";
/**
 * Clerk path preflight — checks env readiness without claiming verification.
 *
 * Usage:
 *   npx ts-node scripts/clerk-path-preflight.ts
 *   # or after build:
 *   node lib/scripts/clerk-path-preflight.js
 *
 * Exit codes:
 *   0 = ready (keys look configured; still requires live checklist)
 *   2 = externally blocked (missing/placeholder keys)
 */
function isRealKey(value, prefixes, placeholderNeedle) {
    if (!value)
        return false;
    if (value.includes(placeholderNeedle) || value.includes('your_key') || value.includes('your_webhook')) {
        return false;
    }
    return prefixes.some(p => value.startsWith(p));
}
function runClerkPreflight() {
    const checks = [];
    const clerkSecret = process.env.CLERK_SECRET_KEY;
    const clerkPublishable = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
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
    });
    checks.push({
        id: 'functions_or_web_publishable',
        ok: isRealKey(clerkPublishable, ['pk_'], 'your_key'),
        detail: clerkPublishable
            ? isRealKey(clerkPublishable, ['pk_'], 'your_key')
                ? 'Publishable key present'
                : 'Publishable key looks like a placeholder'
            : 'CLERK_PUBLISHABLE_KEY / NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY missing',
    });
    checks.push({
        id: 'webhook_secret',
        ok: isRealKey(webhookSecret, ['whsec_'], 'your_webhook'),
        detail: webhookSecret
            ? isRealKey(webhookSecret, ['whsec_'], 'your_webhook')
                ? 'CLERK_WEBHOOK_SECRET present'
                : 'CLERK_WEBHOOK_SECRET looks like a placeholder'
            : 'CLERK_WEBHOOK_SECRET missing (required for live membership sync)',
    });
    checks.push({
        id: 'web_pair',
        ok: isRealKey(webPk, ['pk_'], 'your_key') && isRealKey(webSk, ['sk_'], 'your_key'),
        detail: isRealKey(webPk, ['pk_'], 'your_key') && isRealKey(webSk, ['sk_'], 'your_key')
            ? 'Web NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY ready'
            : 'Web Clerk key pair incomplete (set apps/web/.env.local)',
    });
    const ready = checks.every(c => c.ok);
    const status = ready ? 'ready' : 'externally_blocked';
    console.log('\n=== Clerk path preflight ===\n');
    for (const c of checks) {
        console.log(`${c.ok ? '✓' : '✗'} [${c.id}] ${c.detail}`);
    }
    console.log(`\nstatus: ${status}\n` +
        (ready
            ? 'Keys look configured. Run docs/PHASE2B-MANUAL-VERIFICATION-CHECKLIST.md § Clerk path before claiming verification.\n'
            : 'Clerk live path is externally blocked until real keys are provided. Do not claim Clerk verification.\n'));
    console.log(JSON.stringify({
        status,
        checks,
        next: status === 'ready'
            ? [
                'Configure clerkWebhook in Clerk Dashboard',
                'Create University A/B orgs + memberships',
                'bootstrapOrganizationMemberships',
                'Run Clerk checklist and record evidence',
            ]
            : [
                'Copy apps/web/.env.local.example → .env.local with real pk_/sk_',
                'Copy firebase/functions/.env.example → .env with real sk_/whsec_',
                'Re-run: npm run preflight:clerk',
            ],
    }, null, 2));
    process.exit(ready ? 0 : 2);
}
runClerkPreflight();
