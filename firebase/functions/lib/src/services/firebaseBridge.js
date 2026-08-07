"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.issueFirebaseBridgeToken = issueFirebaseBridgeToken;
const https_1 = require("firebase-functions/v2/https");
const firebaseApps_1 = require("../firebaseApps");
const IdentityLinkService_1 = require("./IdentityLinkService");
/**
 * Mint a Firebase custom token for mobile callable auth.
 *
 * Paths (fail-closed):
 * 1. Caller already has Firebase auth → remint for that uid
 * 2. Clerk-authenticated context → ensure firebase user + identityLink, mint
 * 3. Operator secret mint (emulator/ops only) via MOBILE_BRIDGE_MINT_SECRET
 *
 * Never accepts opaque Express session tokens (Functions cannot verify them).
 * SOS Express login path is unchanged.
 */
async function issueFirebaseBridgeToken(input) {
    const auth = (0, firebaseApps_1.getAuth)();
    // Path 3 — secret-gated mint for emulator / operator tooling only
    const expectedSecret = process.env.MOBILE_BRIDGE_MINT_SECRET;
    if (expectedSecret &&
        input.operatorSecret &&
        input.operatorSecret === expectedSecret &&
        input.targetFirebaseUid) {
        const firebaseUid = String(input.targetFirebaseUid);
        const customToken = await auth.createCustomToken(firebaseUid, {
            bridge: 'operator_secret',
        });
        return { customToken, firebaseUid, linkedUserId: firebaseUid };
    }
    // Path 1 — already Firebase-authenticated
    if (input.firebaseUidFromAuth) {
        const firebaseUid = String(input.firebaseUidFromAuth);
        const customToken = await auth.createCustomToken(firebaseUid, {
            bridge: 'firebase_refresh',
        });
        let linkedUserId = firebaseUid;
        try {
            const link = await IdentityLinkService_1.IdentityLinkService.resolveByFirebaseUid(firebaseUid);
            linkedUserId = link.userId;
        }
        catch {
            // Link optional on refresh
        }
        return { customToken, firebaseUid, linkedUserId };
    }
    // Path 2 — Clerk context: ensure linked Firebase user
    if (input.context?.authProvider === 'clerk' && input.context.userId) {
        const clerkUserId = input.context.userId;
        const firebaseUid = `clerk_${clerkUserId}`;
        try {
            await auth.getUser(firebaseUid);
        }
        catch {
            await auth.createUser({
                uid: firebaseUid,
                displayName: clerkUserId,
                disabled: false,
            });
        }
        await IdentityLinkService_1.IdentityLinkService.upsertLink({
            clerkUserId,
            firebaseUid,
        });
        const customToken = await auth.createCustomToken(firebaseUid, {
            bridge: 'clerk_link',
            organizationId: input.context.organizationId,
        });
        return { customToken, firebaseUid, linkedUserId: clerkUserId };
    }
    throw new https_1.HttpsError('unauthenticated', 'Firebase bridge requires Clerk session, existing Firebase auth, or operator mint secret');
}
