import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY } from '../constants/app';

const DEV_API_OVERRIDE_KEY = 'DEV_API_BASE_URL';
const FETCH_TIMEOUT_MS = 8000;

function resolveMetroHost(): string | null {
  const expoConstants = Constants as {
    expoConfig?: { hostUri?: string; extra?: { apiBaseUrl?: string; lanIp?: string } };
    expoGoConfig?: { debuggerHost?: string };
    manifest2?: { extra?: { expoClient?: { hostUri?: string; apiBaseUrl?: string } } };
    manifest?: { debuggerHost?: string };
  };

  const fromExtra =
    expoConstants.expoConfig?.extra?.apiBaseUrl ||
    expoConstants.manifest2?.extra?.expoClient?.apiBaseUrl;
  if (fromExtra) return fromExtra.replace(/\/$/, '');

  const candidates = [
    expoConstants.expoConfig?.hostUri,
    expoConstants.expoGoConfig?.debuggerHost,
    expoConstants.manifest2?.extra?.expoClient?.hostUri,
    expoConstants.manifest?.debuggerHost,
  ].filter(Boolean) as string[];

  for (const raw of candidates) {
    const host = raw.split(':')[0]?.trim();
    if (!host) continue;
    if (host === 'localhost' || host === '127.0.0.1') continue;
    if (host.includes('exp.direct')) continue;
    return host;
  }
  return null;
}

function buildBaseUrl(hostOrUrl: string): string {
  if (hostOrUrl.startsWith('http')) return hostOrUrl.replace(/\/$/, '');
  return `http://${hostOrUrl}:4000`;
}

function resolveApiBaseUrlSync(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const host = resolveMetroHost();
  if (host) {
    if (host.startsWith('http')) return host.replace(/\/$/, '');
    return `http://${host}:4000`;
  }

  if (Platform.OS === 'android' && !Device.isDevice) {
    return 'http://10.0.2.2:4000';
  }
  return 'http://localhost:4000';
}

let apiBaseUrl = resolveApiBaseUrlSync();

export async function initApiBaseUrl(): Promise<string> {
  try {
    const override = await AsyncStorage.getItem(DEV_API_OVERRIDE_KEY);
    if (override?.trim()) {
      apiBaseUrl = buildBaseUrl(override.trim());
    }
  } catch {
    // ignore
  }
  return apiBaseUrl;
}

export async function setDevApiBaseUrl(url: string | null): Promise<void> {
  if (url?.trim()) {
    apiBaseUrl = buildBaseUrl(url.trim());
    await AsyncStorage.setItem(DEV_API_OVERRIDE_KEY, apiBaseUrl);
  } else {
    apiBaseUrl = resolveApiBaseUrlSync();
    await AsyncStorage.removeItem(DEV_API_OVERRIDE_KEY);
  }
}

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

export const API_BASE_URL = apiBaseUrl;

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export class ApiConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiConnectionError';
  }
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiConnectionError(
        `Server did not respond in time at ${getApiBaseUrl()}. Check Wi‑Fi and server URL below.`
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function request(path: string, options: RequestInit, useAuth: boolean) {
  const url = `${getApiBaseUrl()}${path}`;
  let res: Response;
  try {
    const headers = useAuth
      ? { ...(await getAuthHeaders()), ...(options.headers as Record<string, string>) }
      : {
          'Content-Type': 'application/json',
          ...(options.headers as Record<string, string>),
        };
    res = await fetchWithTimeout(url, { ...options, headers });
  } catch (e) {
    if (e instanceof ApiConnectionError) throw e;
    throw new ApiConnectionError(
      `Cannot reach dispatch server at ${getApiBaseUrl()}.\n\n` +
        `• Run: npm run server\n` +
        `• Phone and Mac on same Wi‑Fi\n` +
        `• On Android, set server URL on the sign-in screen (dev) or restart Expo with:\n` +
        `  EXPO_PUBLIC_API_BASE_URL=http://YOUR_MAC_IP:4000 npx expo start --lan`
    );
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Request failed: ${res.status}`);
    (err as Error & { code?: string }).code = body.code;
    throw err;
  }
  return body;
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  return request(path, options, true);
}

export async function authFetch(path: string, options: RequestInit = {}) {
  return request(path, options, false);
}

export async function pingServer(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${getApiBaseUrl()}/health`, {}, 5000);
    const body = await res.json().catch(() => ({}));
    return res.ok && body.ok === true;
  } catch {
    return false;
  }
}
