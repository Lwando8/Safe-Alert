import * as Device from 'expo-device';
import { getApiBaseUrl, fetchWithTimeout, pingServer } from './ApiClient';

export type DeviceAccess = {
  responder: boolean;
  admin: boolean;
  deviceId?: string | null;
  devMode?: boolean;
  serverReachable?: boolean;
  needsRegistration?: boolean;
};

export async function getDeviceId(): Promise<string> {
  return Device.osBuildId || Device.modelId || 'unknown-device';
}

function clientDevOverride(): DeviceAccess | null {
  if (!__DEV__) return null;
  if (process.env.EXPO_PUBLIC_FORCE_CITIZEN_ONLY === 'true') {
    return { responder: false, admin: false, serverReachable: false };
  }
  if (process.env.EXPO_PUBLIC_SHOW_OPERATIONAL_LOGIN === 'true') {
    return { responder: true, admin: true, devMode: true, serverReachable: true };
  }
  return null;
}

function devOperationalAccess(deviceId: string, serverReachable: boolean): DeviceAccess {
  return {
    responder: true,
    admin: true,
    devMode: true,
    deviceId,
    serverReachable,
  };
}

/** When server is up in dev, always allow operational sign-in for field testing */
function devGrantIfServerUp(
  deviceId: string,
  serverReachable: boolean,
  fromServer: DeviceAccess
): DeviceAccess {
  if (!__DEV__ || !serverReachable) return fromServer;
  if (fromServer.responder || fromServer.admin) return fromServer;
  return {
    ...devOperationalAccess(deviceId, true),
    needsRegistration: !fromServer.devMode,
  };
}

export async function fetchDeviceAccess(): Promise<DeviceAccess> {
  const override = clientDevOverride();
  if (override) return override;

  const deviceId = await getDeviceId();
  try {
    const res = await fetchWithTimeout(`${getApiBaseUrl()}/auth/device-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (__DEV__ && (await pingServer())) {
        return devOperationalAccess(deviceId, true);
      }
      return { responder: false, admin: false, deviceId, serverReachable: false };
    }

    const fromServer: DeviceAccess = {
      responder: !!body.responder,
      admin: !!body.admin,
      deviceId: body.deviceId ?? deviceId,
      devMode: body.devMode,
      serverReachable: true,
    };

    return devGrantIfServerUp(deviceId, true, fromServer);
  } catch {
    if (__DEV__ && (await pingServer())) {
      return devOperationalAccess(deviceId, true);
    }
    if (__DEV__) {
      return devOperationalAccess(deviceId, false);
    }
    return { responder: false, admin: false, deviceId, serverReachable: false };
  }
}

/** After user confirms server URL works, refresh and ensure dev operational buttons show */
export async function fetchDeviceAccessAfterConnect(): Promise<DeviceAccess> {
  const access = await fetchDeviceAccess();
  if (__DEV__ && access.serverReachable) {
    return {
      ...access,
      responder: true,
      admin: true,
      devMode: true,
    };
  }
  return access;
}
