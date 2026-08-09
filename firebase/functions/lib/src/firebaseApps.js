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
exports.ensureAdminApp = ensureAdminApp;
exports.getDb = getDb;
exports.isRtdbEmulatorConfigured = isRtdbEmulatorConfigured;
exports.getRtdb = getRtdb;
exports.safeRtdbWrite = safeRtdbWrite;
exports.getAuth = getAuth;
const admin = __importStar(require("firebase-admin"));
/** Ensure default app exists before any Admin SDK service access. */
function ensureAdminApp() {
    if (!admin.apps.length) {
        admin.initializeApp();
    }
    return admin.app();
}
ensureAdminApp();
function getDb() {
    ensureAdminApp();
    return admin.firestore();
}
function isRtdbEmulatorConfigured() {
    return Boolean(process.env.FIREBASE_DATABASE_EMULATOR_HOST || process.env.DATABASE_EMULATOR_HOST);
}
/**
 * Lazy RTDB access — fails clearly if the project has no Realtime Database URL.
 */
function getRtdb() {
    ensureAdminApp();
    try {
        return admin.database();
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Realtime Database unavailable (${message}). Create an RTDB instance for project seren-sos or set databaseURL.`);
    }
}
/**
 * Best-effort RTDB write. Never blocks incident create/update when RTDB is missing
 * (lab without database emulator previously hung ~60s against production URL).
 */
async function safeRtdbWrite(label, write, timeoutMs = 1500) {
    if (process.env.FIRESTORE_EMULATOR_HOST && !isRtdbEmulatorConfigured()) {
        console.warn(`[${label}] skip RTDB write — Firestore emulator on, RTDB emulator not configured`);
        return;
    }
    try {
        const db = getRtdb();
        await Promise.race([
            Promise.resolve(write(db)),
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`${label} RTDB timeout after ${timeoutMs}ms`)), timeoutMs);
            }),
        ]);
    }
    catch (err) {
        console.error(`${label} RTDB write failed (non-fatal)`, err);
    }
}
function getAuth() {
    ensureAdminApp();
    return admin.auth();
}
