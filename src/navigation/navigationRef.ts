import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from '../types';
import type { PushDeepLinkPayload } from '../services/NotificationService';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

let pendingPush: PushDeepLinkPayload | null = null;

export function queueOrNavigatePushDeepLink(payload: PushDeepLinkPayload) {
  if (navigationRef.isReady()) {
    navigatePushDeepLink(payload);
    return;
  }
  pendingPush = payload;
}

export function flushPendingPushDeepLink() {
  if (!pendingPush || !navigationRef.isReady()) return;
  const payload = pendingPush;
  pendingPush = null;
  navigatePushDeepLink(payload);
}

function navigatePushDeepLink(payload: PushDeepLinkPayload) {
  const workOrderId = payload.workOrderId ? String(payload.workOrderId) : '';
  if (workOrderId) {
    // Nested Responder stack. Remote FCM needs a dev client; Expo Go is local/test only.
    navigationRef.navigate('Responder', {
      screen: 'ResponderWorkOrderDetail',
      params: { workOrderId },
    });
    return;
  }
  const incidentId = payload.incidentId ? String(payload.incidentId) : '';
  if (incidentId) {
    navigationRef.navigate('Responder', {
      screen: 'ResponderAlertDetail',
      params: { alertId: incidentId },
    });
  }
}
