"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadActiveMembershipForUser = loadActiveMembershipForUser;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const db = admin.firestore();
function asMembershipRecord(id, raw) {
    return {
        id,
        clerkMembershipId: String(raw.clerkMembershipId || ''),
        clerkOrganizationId: String(raw.clerkOrganizationId || ''),
        organizationId: String(raw.organizationId || ''),
        userId: String(raw.userId || ''),
        siteId: String(raw.siteId || ''),
        zoneIds: Array.isArray(raw.zoneIds) ? raw.zoneIds : undefined,
        kind: String(raw.kind || ''),
        status: String(raw.status || ''),
        clerkRole: String(raw.clerkRole || ''),
        permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
        responderProfile: raw.responderProfile,
    };
}
/**
 * Load exactly one active membership for a user.
 * organizationIdHint (e.g. Firebase claim) may narrow candidates but cannot
 * invent an org or override a non-matching membership set.
 */
async function loadActiveMembershipForUser(params) {
    const { userId, organizationId, organizationIdHint } = params;
    if (organizationId) {
        const snap = await db
            .collection('memberships')
            .where('userId', '==', userId)
            .where('organizationId', '==', organizationId)
            .where('status', '==', 'active')
            .limit(2)
            .get();
        if (snap.empty) {
            throw new https_1.HttpsError('failed-precondition', 'No active membership found for this organization. Your membership may be suspended or revoked.');
        }
        if (snap.size > 1) {
            throw new https_1.HttpsError('failed-precondition', 'Ambiguous membership mapping. Access denied.');
        }
        const doc = snap.docs[0];
        return { id: doc.id, data: asMembershipRecord(doc.id, doc.data()) };
    }
    const allActive = await db
        .collection('memberships')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .limit(10)
        .get();
    if (allActive.empty) {
        throw new https_1.HttpsError('failed-precondition', 'No active membership found. Your membership may be suspended or revoked.');
    }
    if (organizationIdHint) {
        const matched = allActive.docs.filter(d => String(d.data().organizationId || '') === organizationIdHint);
        if (matched.length === 1) {
            const doc = matched[0];
            return { id: doc.id, data: asMembershipRecord(doc.id, doc.data()) };
        }
        if (matched.length === 0) {
            throw new https_1.HttpsError('failed-precondition', 'Claimed organization does not match an active membership. Access denied.');
        }
        throw new https_1.HttpsError('failed-precondition', 'Ambiguous membership mapping. Access denied.');
    }
    if (allActive.size === 1) {
        const doc = allActive.docs[0];
        return { id: doc.id, data: asMembershipRecord(doc.id, doc.data()) };
    }
    throw new https_1.HttpsError('failed-precondition', 'Multiple active memberships and no unambiguous organization. Select an organization or use Clerk session.');
}
