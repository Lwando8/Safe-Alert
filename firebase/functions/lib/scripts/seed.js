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
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();
async function upsertUser(email, password, claims, profile) {
    let user;
    try {
        user = await auth.getUserByEmail(email);
    }
    catch {
        user = await auth.createUser({ email, password, displayName: String(profile.fullName || email) });
    }
    await auth.setCustomUserClaims(user.uid, claims);
    await db.doc(`users/${user.uid}`).set({
        id: user.uid,
        email,
        ...profile,
        updatedAt: Date.now(),
        createdAt: Date.now(),
    }, { merge: true });
    return user.uid;
}
async function run() {
    const citizenUid = await upsertUser('demo@safealert.com', 'demo123', { role: 'CITIZEN' }, { fullName: 'Demo Citizen', phone: null, providerId: null });
    await upsertUser('dispatch@safealert.com', 'admin123', { role: 'DISPATCHER' }, { fullName: 'Dispatch Admin' });
    const unitRef = db.doc('responderUnits/ALPHA12');
    await unitRef.set({
        unitCode: 'ALPHA-12',
        loginId: 'ALPHA-12',
        password: 'unit123',
        responderType: 'police',
        organizationId: 'org-default',
        active: true,
        status: 'offline',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        authEmail: 'alpha-12@safealert.local',
    }, { merge: true });
    await db.doc('admins/dispatch@safealert.com').set({ name: 'Dispatch Admin', role: 'DISPATCHER', password: 'admin123' }, { merge: true });
    await db.doc(`users/${citizenUid}/emergencyContacts/demo-contact`).set({
        name: 'Demo Contact',
        phone: '+27000000000',
        relationship: 'Family',
        updatedAt: Date.now(),
    });
    console.log('Firebase demo seed complete');
}
run().catch(err => {
    console.error(err);
    process.exit(1);
});
